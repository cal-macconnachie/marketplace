import Stripe from 'stripe'
import { v4 as uuidv4 } from 'uuid'
import { Organization } from '../../handlers/organizations'
import {
  Product, PurchasedProduct 
} from '../../handlers/products'
import { User } from '../../handlers/users'
import { Purchase } from '../../handlers/purchases'
import { getStripeClient } from './stripe-client'
import { getPromoByCode } from './get-promo-by-code'
import { update } from '../dynamo-helpers/update'
import { calculatePlatformFee } from './calculate-platform-fee'
import { calculateTaxesWithCaching } from '../tax/calculate-taxes-with-caching'
import { generateLocationKey } from '../tax/tax-calculation-cache'
import { convertAddressToCodes } from '../tax/address-code-converter'
import { addPurchase } from '../add-purchase'

type DiscountsParam = Array<{ promotion_code?: string; coupon?: string }>

// Manage a subscription for a set of products. Products may span connected accounts; we
// handle each account independently. The function creates/updates/cancels a subscription
// per connected account, enables automatic tax, and applies platform fees via
// application_fee_percent. Transfers are handled implicitly by using direct charges on
// connected accounts (subscription created with stripeAccount header), so funds settle to
// the connected account and the platform fee is collected automatically by Stripe.
export const manageSubscription = async ({
  promotionCode,
  couponId,
  products,
  paymentMethodId,
  user,
  organization,
  remove = false,
  ipAddress,
  cartId,
}: {
  promotionCode?: string
  couponId?: string
  paymentMethodId?: string
  products: Product[]
  user: User
  organization: Organization
  remove: boolean
  ipAddress?: string
  cartId: string
}): Promise<Purchase[] | void> => {
  if (!user.stripe_id) return

  const stripe = getStripeClient()

  // Group products by connected account
  const byAccount = products.reduce<Record<string, Product[]>>((acc, p) => {
    acc[p.account_id] = acc[p.account_id] || []
    acc[p.account_id].push(p)
    return acc
  }, {})

  const purchases: Purchase[] = []
  const subscriptionIds = { ...(organization.stripe_subscription_ids ?? {}) }
  let purchasedProducts: PurchasedProduct[] = [...(organization.purchased_products ?? [])]

  const distributeAmount = (total: number, qty: number): number[] => {
    if (qty <= 0) return []
    const base = Math.floor(total / qty)
    let remainder = total - base * qty
    const arr = Array(qty).fill(base)
    for (let i = 0; i < qty; i++) {
      if (remainder <= 0) break
      arr[i] += 1
      remainder -= 1
    }
    return arr
  }

  const resolveLocation = (): string => {
    const fromUser = generateLocationKey(user, ipAddress)
    if (fromUser) return fromUser
    if (organization.address) {
      const codes = convertAddressToCodes({
        country: organization.address.country,
        state: organization.address.state,
        city: organization.address.city,
        postal_code: organization.address.postal_code,
      })
      return `${codes.country || 'US'}:${codes.state || 'unknown'}:${codes.city || 'unknown'}:${codes.postal_code || 'unknown'}`
    }
    return 'US:unknown:unknown:unknown'
  }
  const locationKey = resolveLocation()

  const resolveDiscounts = async (): Promise<DiscountsParam | undefined> => {
    const d: DiscountsParam = []
    if (promotionCode) {
      const promo = await getPromoByCode(promotionCode)
      if (!promo || promo.type !== 'promotion_code') throw new Error(`Promotion code ${promotionCode} not found`)
      const promoId = promo.stripeId || promo.id
      const pc = await stripe.promotionCodes.retrieve(promoId)
      if (!pc.active) throw new Error(`Promotion code ${promotionCode} is not active`)
      d.push({ promotion_code: promoId })
    }
    if (couponId) {
      const c = await stripe.coupons.retrieve(couponId)
      if (!c.valid) throw new Error(`Coupon ${couponId} is not valid`)
      d.push({ coupon: couponId })
    }
    return d.length ? d : undefined
  }

  const fetchPriceForProduct = async (
    accountId: string,
    product: Product
  ): Promise<{ priceId: string; metered: boolean; unitAmount: number; currency: string }> => {
    if (product.price_id) {
      const price = await stripe.prices.retrieve(product.price_id)
      return {
        priceId: price.id,
        metered: price.recurring?.usage_type === 'metered',
        unitAmount: price.unit_amount ?? 0,
        currency: price.currency,
      }
    }
    const sp = await stripe.products.retrieve(product.id)
    const priceId = typeof sp.default_price === 'string' ? sp.default_price : sp.default_price?.id
    if (!priceId) throw new Error(`No default price on product ${product.id}`)
    const price = await stripe.prices.retrieve(priceId)
    return {
      priceId: price.id,
      metered: price.recurring?.usage_type === 'metered',
      unitAmount: price.unit_amount ?? 0,
      currency: price.currency,
    }
  }

  for (const accountId of Object.keys(byAccount)) {
    const accountProducts = byAccount[accountId]
    const discounts = await resolveDiscounts()
    // Subscription platform fee is percentage-only; compute once per account
    const subscriptionFeePercent = await calculatePlatformFee({
      organizationId: organization.id,
      subscription: true,
    })

    // Build desired items (aggregate quantity for non-metered)
    const desiredItemsRaw = await Promise.all(
      accountProducts.map(async (p) => ({
        product: p, ...(await fetchPriceForProduct(accountId, p)) 
      }))
    )
    const desiredItems = desiredItemsRaw.reduce<Record<string, { price: string; quantity?: number; meta: typeof desiredItemsRaw[number] }>>(
      (acc, it) => {
        const existing = acc[it.priceId]
        if (it.metered) {
          if (!existing) acc[it.priceId] = {
            price: it.priceId, meta: it 
          }
        } else {
          acc[it.priceId] = {
            price: it.priceId,
            quantity: (existing?.quantity ?? 0) + 1,
            meta: it,
          }
        }
        return acc
      },
      {}
    )

    const currentSubId = subscriptionIds[accountId]
    let subscription: Stripe.Subscription | undefined

    if (!currentSubId && remove) {
      throw new Error(`No subscription found for account ${accountId} to remove items`)
    }

    if (!currentSubId && !remove) {
      // Create new subscription (direct charge on connected account)
      const items: Stripe.SubscriptionCreateParams.Item[] = Object.values(desiredItems).map((it) => ({
        price: it.price,
        ...(it.quantity != null ? { quantity: it.quantity } : {}),
      }))
      const platformFeePercent = subscriptionFeePercent
      const createParams: Stripe.SubscriptionCreateParams = {
        customer: user.stripe_id,
        items,
        ...(discounts ? { discounts } : {}),
        collection_method: 'charge_automatically',
        payment_behavior: 'allow_incomplete',
        ...(paymentMethodId ? { default_payment_method: paymentMethodId } : {}),
        metadata: {
          connected_account_id: accountId,
          ...(cartId ? { cart_id: cartId } : {})
        },
        automatic_tax: {
          enabled: true,
          liability: {
            type: 'account', account: accountId 
          },
        },
        transfer_data: { destination: accountId },
        on_behalf_of: accountId,
        application_fee_percent: platformFeePercent
      }

      subscription = await stripe.subscriptions.create(createParams)
      subscriptionIds[accountId] = subscription.id

      // Calculate taxes for recording and build purchases
      const productsHash = Object.values(desiredItems).reduce<{ [k: string]: Product }>((acc, it) => {
        acc[`${it.meta.product.group_id}:${it.meta.product.id}`] = it.meta.product
        return acc
      }, {})
      const taxItems = Object.values(desiredItems).map((it) => ({
        group_id: it.meta.product.group_id,
        id: it.meta.product.id,
        organization_id: organization.id,
        quantity: it.quantity ?? 1,
      }))
      const orgsHash = { [organization.id]: organization }
      const taxCalc = await calculateTaxesWithCaching(taxItems, productsHash, orgsHash, locationKey)

      for (const item of taxCalc.items) {
        const qty = item.quantity
        const basePer = distributeAmount(item.amount, qty)
        const taxPer = distributeAmount(item.tax_amount, qty)
        const product = productsHash[`${item.group_id}:${item.id}`]
        for (let i = 0; i < qty; i++) {
          const total = basePer[i] + taxPer[i]
          purchasedProducts.push({
            unique_id: uuidv4(),
            id: item.id,
            group_id: item.group_id,
            name: product.name,
            metadata: product.metadata,
            amount: total,
            currency: item.currency,
            user_id: user.id,
          })
          // Defer creation of persistent purchase records to invoice webhook
          // so we can attach the exact application fee and charge id.
        }
      }
      continue
    }

    // Update existing subscription
    subscription = await stripe.subscriptions.retrieve(currentSubId!)
    const existingItems = subscription.items.data
    let didProrate = false

    if (remove) {
      for (const it of Object.values(desiredItems)) {
        const existing = existingItems.find((si) => si.price.id === it.price)
        if (!existing) continue
        if (it.meta.metered || (existing.quantity ?? 1) <= (it.quantity ?? 1)) {
          if (existingItems.length <= 1) {
            await stripe.subscriptions.cancel(subscription.id, {
              prorate: true, invoice_now: false 
            })
            delete subscriptionIds[accountId]
            const toRemoveIds = new Set(accountProducts.map((p) => p.id))
            purchasedProducts = purchasedProducts.filter((pp) => !toRemoveIds.has(pp.id))
            break
          } else {
            await stripe.subscriptionItems.del(existing.id)
            didProrate = true
            // remove matching quantity of purchased products
            let removed = 0
            const toRemove = it.quantity ?? 1
            purchasedProducts = purchasedProducts.filter((pp) => {
              if (pp.id === it.meta.product.id && removed < toRemove) {
                removed++
                return false
              }
              return true
            })
          }
        } else {
          const newQty = (existing.quantity ?? 1) - (it.quantity ?? 1)
          await stripe.subscriptionItems.update(existing.id, {
            quantity: newQty, proration_behavior: 'create_prorations' 
          })
          didProrate = true
          let removed = 0
          const toRemove = it.quantity ?? 1
          purchasedProducts = purchasedProducts.filter((pp) => {
            if (pp.id === it.meta.product.id && removed < toRemove) {
              removed++
              return false
            }
            return true
          })
        }
      }
    } else {
      for (const it of Object.values(desiredItems)) {
        const existing = existingItems.find((si) => si.price.id === it.price)
        if (existing) {
          if (!it.meta.metered) {
            const newQty = (existing.quantity ?? 1) + (it.quantity ?? 1)
            await stripe.subscriptionItems.update(existing.id, {
              quantity: newQty, proration_behavior: 'create_prorations' 
            })
            didProrate = true
            const qtyAdded = it.quantity ?? 1
            const productsHash = { [`${it.meta.product.group_id}:${it.meta.product.id}`]: it.meta.product }
            const taxItems = [
              {
                group_id: it.meta.product.group_id, id: it.meta.product.id, organization_id: organization.id, quantity: qtyAdded 
              }
            ]
            const taxCalc = await calculateTaxesWithCaching(taxItems, productsHash, { [organization.id]: organization }, locationKey)
            const tx = taxCalc.items[0]
            const basePer = distributeAmount(tx.amount, qtyAdded)
            const taxPer = distributeAmount(tx.tax_amount, qtyAdded)
            for (let i = 0; i < qtyAdded; i++) {
              const total = basePer[i] + taxPer[i]
              const feeAmt = Math.round(total * (subscriptionFeePercent / 100))
              purchasedProducts.push({
                unique_id: uuidv4(),
                id: it.meta.product.id,
                group_id: it.meta.product.group_id,
                name: it.meta.product.name,
                metadata: it.meta.product.metadata,
                amount: total,
                currency: tx.currency,
                user_id: user.id,
              })
              const purchase: Purchase = {
                id: uuidv4(),
                user_id: user.id,
                product_id: it.meta.product.id,
                product_name: it.meta.product.name,
                is_one_time: false,
                is_subscription: true,
                purchased_at: new Date().toISOString(),
                organization_id: organization.id,
                payment_method_id: paymentMethodId || '',
                amount: total,
                currency: tx.currency,
                platform_fee_amount: feeAmt,
                connected_account_id: accountId,
                destination_charge_id: subscription.id,
                base_amount: basePer[i],
                tax_amount: taxPer[i],
                cart_id: cartId
              }
              const persisted = await addPurchase(purchase, it.meta.product)
              purchases.push(persisted)
            }
          }
        } else {
          await stripe.subscriptionItems.create({
            subscription: subscription.id,
            price: it.price,
            ...(it.meta.metered ? {} : { quantity: it.quantity ?? 1 }),
            ...(discounts ? { discounts } : {}),
            proration_behavior: 'create_prorations',
          })
          didProrate = true
          const qty = it.quantity ?? 1
          const productsHash = { [`${it.meta.product.group_id}:${it.meta.product.id}`]: it.meta.product }
          const taxItems = [
            {
              group_id: it.meta.product.group_id, id: it.meta.product.id, organization_id: organization.id, quantity: qty 
            }
          ]
          const taxCalc = await calculateTaxesWithCaching(taxItems, productsHash, { [organization.id]: organization }, locationKey)
          const tx = taxCalc.items[0]
          const basePer = distributeAmount(tx.amount, qty)
          const taxPer = distributeAmount(tx.tax_amount, qty)
          for (let i = 0; i < qty; i++) {
            const total = basePer[i] + taxPer[i]
            const feeAmt = Math.round(total * (subscriptionFeePercent / 100))
            purchasedProducts.push({
              unique_id: uuidv4(),
              id: it.meta.product.id,
              group_id: it.meta.product.group_id,
              name: it.meta.product.name,
              metadata: it.meta.product.metadata,
              amount: total,
              currency: tx.currency,
              user_id: user.id,
            })
            const purchase: Purchase = {
              id: uuidv4(),
              user_id: user.id,
              product_id: it.meta.product.id,
              product_name: it.meta.product.name,
              is_one_time: false,
              is_subscription: true,
              purchased_at: new Date().toISOString(),
              organization_id: organization.id,
              payment_method_id: paymentMethodId || '',
              amount: total,
              currency: tx.currency,
              platform_fee_amount: feeAmt,
              connected_account_id: accountId,
              destination_charge_id: subscription.id,
              base_amount: basePer[i],
              tax_amount: taxPer[i],
              cart_id: cartId
            }
            const persisted = await addPurchase(purchase, it.meta.product)
            purchases.push(persisted)
          }
        }
      }

      // Keep anchor unchanged and re-apply high-level settings
      const platformFeePercent = subscriptionFeePercent
      await stripe.subscriptions.update(
        subscription.id,
        {
          billing_cycle_anchor: 'unchanged',
          metadata: { connected_account_id: accountId },
          automatic_tax: {
            enabled: true,
            liability: {
              type: 'account', account: accountId 
            },
          },
          transfer_data: { destination: accountId },
          on_behalf_of: accountId,
          application_fee_percent: platformFeePercent,
          ...(discounts ? { discounts } : {}),
        }
      )

      // If prorations were created, invoice them immediately so the
      // upcoming invoice only contains the regular cycle amount.
      if (didProrate) {
        try {
          const invoice = await stripe.invoices.create({
            customer: user.stripe_id,
            subscription: subscription.id,
            collection_method: 'charge_automatically',
            metadata: { connected_account_id: accountId },
            automatic_tax: {
              enabled: true,
            },
            on_behalf_of: accountId,
            transfer_data: { destination: accountId },
          })

          // Only attempt payment if there is something to pay
          if ((invoice.total ?? 0) > 0 && invoice.id) {
            const finalized = await stripe.invoices.finalizeInvoice(invoice.id)
            if (finalized.status !== 'paid') {
              await stripe.invoices.pay(invoice.id)
            }

            // Retrieve paid invoice's payment intent and allocate exact application fee to purchases
            const paid = await stripe.invoices.retrieve(invoice.id)
            let chargeId: string | undefined
            // Look for payment_intent in the payments array
            const invoicePayment = paid.payments?.data?.[0]
            if (invoicePayment?.payment?.payment_intent) {
              const paymentIntentId = typeof invoicePayment.payment.payment_intent === 'string' ? invoicePayment.payment.payment_intent : invoicePayment.payment.payment_intent.id
              try {
                const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
                chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id
              } catch (e) {
                console.warn('Unable to retrieve payment intent for proration invoice', invoice.id, e)
              }
            }
            if (chargeId) {
              const fees = await stripe.applicationFees.list({
                charge: chargeId, limit: 100 
              })
              const totalFee = fees.data.reduce((sum, f) => sum + (f.amount || 0), 0)
              // purchases created in this update path belong at the end of the array
              const accountPurchases = purchases.filter(p => p.connected_account_id === accountId)
              const totalPurchaseAmount = accountPurchases.reduce((s, p) => s + (p.amount || 0), 0)
              if (totalFee > 0 && totalPurchaseAmount > 0 && accountPurchases.length > 0) {
                // Proportional allocation with rounding guard
                let allocated = 0
                for (let i = 0; i < accountPurchases.length; i++) {
                  const p = accountPurchases[i]
                  let fee = i === accountPurchases.length - 1
                    ? totalFee - allocated
                    : Math.round((p.amount / totalPurchaseAmount) * totalFee)
                  if (fee < 0) fee = 0
                  allocated += fee
                  try {
                    await update<Purchase>({
                      tableName: process.env.PURCHASES_TABLE!,
                      key: {
                        id: p.id, user_id: p.user_id 
                      },
                      updates: {
                        platform_fee_amount: fee, destination_charge_id: chargeId 
                      },
                    })
                  } catch (e) {
                    console.error('Failed to update purchase with exact platform fee:', e)
                  }
                }
              } else {
                // Still set destination charge id
                for (const p of accountPurchases) {
                  try {
                    await update<Purchase>({
                      tableName: process.env.PURCHASES_TABLE!,
                      key: {
                        id: p.id, user_id: p.user_id 
                      },
                      updates: { destination_charge_id: chargeId },
                    })
                  } catch (e) {
                    console.error('Failed to set destination_charge_id on purchase:', e)
                  }
                }
              }
            }
          }
        } catch (err) {
          console.error('Failed to invoice prorations immediately:', err)
        }
      }
    }
  }

  // Persist organization changes
  await update<Organization>({
    tableName: process.env.ORGANIZATIONS_TABLE!,
    key: { id: organization.id },
    updates: {
      stripe_subscription_ids: Object.keys(byAccount).length ? subscriptionIds : organization.stripe_subscription_ids,
      purchased_products: purchasedProducts,
    },
  })

  return purchases
}
