import Stripe from "stripe"
import { Organization } from "../../handlers/organizations"
import {
  Product, PurchasedProduct 
} from "../../handlers/products"
import { User } from "../../handlers/users"
import { getStripeClient } from "./stripe-client"
import { getPromoByCode } from "./get-promo-by-code"
import { v4 } from "uuid"
import { update } from "../dynamo-helpers/update"
import {
  addDays, addMonths, addWeeks, addYears 
} from "date-fns"
import { addPurchase } from "../add-purchase"
import { Purchase } from "../../handlers/purchases"
import {
  calculatePlatformFee, calculateConnectedAccountAmount 
} from './calculate-platform-fee'
import { get } from '../dynamo-helpers/get'

export const manageSubscription = async ({
  promotionCode,
  couponId,
  products,
  paymentMethodId,
  user,
  organization,
  remove = false,
  customerLocation,
  taxCode
}: {
  promotionCode?: string
  couponId?: string
  paymentMethodId?: string
  products: Product[]
  user: User
  organization: Organization
  remove: boolean
  customerLocation?: string
  taxCode?: string
}) => {
  if (user.stripe_id == null) {
    // not a customer return
    return
  }
  // subscriptions can have many prices
  // if there is no org subscription one must be started
  // if we are removing a subscription product, we need to 1. ensure it is a part of the subscription and if it is the last item in a subscription we need to cancel the subscription instead of removing it from the sub
  const stripe = getStripeClient()
  
  // Group products by connected account and handle them separately
  const productsByAccount = products.reduce((acc, product) => {
    if (!acc[product.account_id]) {
      acc[product.account_id] = []
    }
    acc[product.account_id].push(product)
    return acc
  }, {} as Record<string, Product[]>)
  
  const accountIds = Object.keys(productsByAccount)
  
  // If multiple accounts, handle each account separately
  if (accountIds.length > 1) {
    // Need to import the get function to refresh organization data between calls
    let currentOrg = organization
    
    for (const accountId of accountIds) {
      await manageSubscription({
        promotionCode,
        couponId,
        products: productsByAccount[accountId],
        paymentMethodId,
        user,
        organization: currentOrg,
        remove
      })
      
      // Refresh organization data for next iteration
      currentOrg = await get<Organization>({
        tableName: process.env.ORGANIZATIONS_TABLE!,
        key: { id: organization.id }
      }) ?? currentOrg
    }
    return
  }
  
  const connectedAccountId = accountIds[0]
  
  const discounts: Array<{promotion_code?: string, coupon?: string}> = []
  if (promotionCode || couponId) {
    if (promotionCode) {
      // Look up promotion code in database to get the actual Stripe promotion code ID
      const promoRecord = await getPromoByCode(promotionCode)
      if (!promoRecord || promoRecord.type !== 'promotion_code') {
        throw new Error(`Promotion code ${promotionCode} not found`)
      }
        
      // Use stripeId if available, fallback to id for backwards compatibility
      const stripePromoId = promoRecord.stripeId || promoRecord.id
        
      // Validate promotion code exists and is active in Stripe
      try {
        const promoCode = await stripe.promotionCodes.retrieve(stripePromoId, {
          stripeAccount: connectedAccountId
        })
        if (!promoCode.active) {
          throw new Error(`Promotion code ${promotionCode} is not active`)
        }
        discounts.push({ promotion_code: stripePromoId })
      } catch {
        throw new Error(`Invalid promotion code: ${promotionCode}`)
      }
    }
      
    if (couponId) {
      // Validate coupon exists and is valid
      try {
        const coupon = await stripe.coupons.retrieve(couponId, {
          stripeAccount: connectedAccountId
        })
        if (!coupon.valid) {
          throw new Error(`Coupon ${couponId} is not valid`)
        }
        discounts.push({ coupon: couponId })
      } catch {
        throw new Error(`Invalid coupon: ${couponId}`)
      }
    }
  }
  // Get current subscription ID for this connected account
  const currentOrgSubscriptionId = organization.stripe_subscription_ids?.[connectedAccountId]
  // Get unique product IDs to avoid duplicate Stripe calls
  const uniqueProductIds = [...new Set(products.map(product => product.id))]
  
  let [
    subscription,
    stripeProducts
  ] = await Promise.all([
    currentOrgSubscriptionId ? stripe.subscriptions.retrieve(currentOrgSubscriptionId, {
      stripeAccount: connectedAccountId
    }) : Promise.resolve(undefined),
    Promise.all(uniqueProductIds.map(productId => stripe.products.retrieve(productId, {
      stripeAccount: connectedAccountId
    }))),
  ])
  
  // Get prices with expanded product info to check for metered billing
  const stripePrices = await Promise.all(stripeProducts.map(stripeProduct => {
    const priceId = typeof stripeProduct.default_price === 'string'
      ? stripeProduct.default_price
      : stripeProduct.default_price?.id
    return priceId ? stripe.prices.retrieve(priceId, {
      stripeAccount: connectedAccountId
    }) : Promise.resolve(null)
  }))
  const priceIds = stripeProducts.reduce((acc: { [productId: string]: string }, stripeProduct) => {
    const priceId = typeof stripeProduct.default_price === 'string'
      ? stripeProduct.default_price
      : stripeProduct.default_price?.id
    if (priceId) {
      acc[stripeProduct.id] = priceId
    }
    return acc
  }, {})
  const productKeysByPrice = stripeProducts.reduce((acc: { [priceId: string]: { group_id: string; id: string } }, stripeProduct) => {
    const priceId = typeof stripeProduct.default_price === 'string'
      ? stripeProduct.default_price
      : stripeProduct.default_price?.id
    if (priceId) {
      acc[priceId] = {
        group_id: stripeProduct.metadata.group_id, id: stripeProduct.id 
      }
    }
    return acc
  }, {})

  // Create mapping of price IDs to determine if they are metered
  const meteredPrices = new Set<string>()
  stripePrices.forEach((price) => {
    if (price && price.recurring?.usage_type === 'metered') {
      meteredPrices.add(price.id)
    }
  })

  if (Object.values(priceIds).some(priceId => !priceId)) {
    throw new Error(`No price found for products ${products.map(product => product.id).join(', ')}`)
  }
  const priceItems = products.reduce((acc: { price: string; quantity?: number }[], product) => {
    const priceId = priceIds[product.id]
    if (!priceId) {
      throw new Error(`No price found for product ${product.id}`)
    }
    
    const isMetered = meteredPrices.has(priceId)
    
    if (isMetered) {
      // For metered products, only add once regardless of duplicates in products array
      if (!acc.find(item => item.price === priceId)) {
        acc.push({ price: priceId })
      }
    } else {
      // For non-metered products, each duplicate product increases quantity
      const existingItem = acc.find(item => item.price === priceId)
      if (existingItem && existingItem.quantity !== undefined) {
        existingItem.quantity += 1
      } else {
        acc.push({
          price: priceId, quantity: 1 
        })
      }
    }
    return acc
  }, [])
  const productChanges: {
    added: { group_id: string; id: string }[]
    removed: { group_id: string; id: string }[]
  } = {
    added: [],
    removed: []
  }
  if (subscription != null) {
    let subscriptionItems = subscription.items.data
    // if adding its simple to add prices or items
    // if remove we need to check we're not removing the last item if we are removing the last item we need to cancel the subscription
    if (remove) {
      for (const priceItem of priceItems) {
        // can only remove items in subScriptionItems
        const existingItem = subscriptionItems.find(item => item.price.id === priceItem.price)
        const priceId = priceItem.price
        const productKey = productKeysByPrice[priceId]
        const isMetered = meteredPrices.has(priceId)
        
        if (existingItem) {
          if (isMetered) {
            // For metered products, simply remove the subscription item
            if (subscriptionItems.length === 1) {
              await stripe.subscriptions.cancel(currentOrgSubscriptionId!)
            } else {
              await stripe.subscriptionItems.del(existingItem.id)
              subscriptionItems = subscriptionItems.filter(item => item.id !== existingItem.id)
            }
            if (productKey) {
              productChanges.removed.push(productKey)
            }
          } else {
            // For non-metered products, handle quantity
            const quantityToRemove = priceItem.quantity ?? 1
            if ((existingItem.quantity ?? 1) <= quantityToRemove) {
              if (subscriptionItems.length === 1) {
                await stripe.subscriptions.cancel(currentOrgSubscriptionId!)
              } else {
                await stripe.subscriptionItems.del(existingItem.id)
                subscriptionItems = subscriptionItems.filter(item => item.id !== existingItem.id)
              }
            } else {
              await stripe.subscriptionItems.update(existingItem.id, {
                quantity: (existingItem.quantity ?? 1) - quantityToRemove
              })
            }
            if (productKey) {
              for (let i = 0; i < quantityToRemove; i++) {
                productChanges.removed.push(productKey)
              }
            }
          }
        }
      }
    } else {
      for (const priceItem of priceItems) {
        // if subscriptionItems contains a matching price then increment quantity otherwise create new subscription item
        const existingItem = subscriptionItems.find(item => item.price.id === priceItem.price)
        const priceId = priceItem.price
        const productKey = productKeysByPrice[priceId]
        const isMetered = meteredPrices.has(priceId)
        
        if (existingItem) {
          if (isMetered) {
            // For metered products, item already exists, just apply discounts if needed
            if (discounts.length > 0) {
              const updateParams: Stripe.SubscriptionItemUpdateParams = {
                discounts: discounts,
                proration_behavior: 'create_prorations'
              }
              await stripe.subscriptionItems.update(existingItem.id, updateParams)
            }
          } else {
            // For non-metered products, update quantity
            const quantityToAdd = priceItem.quantity ?? 1
            const totalPrices = (existingItem.quantity ?? 1) + quantityToAdd
            const updateParams: Stripe.SubscriptionItemUpdateParams = {
              quantity: totalPrices,
              proration_behavior: 'create_prorations'
            }
            if (discounts.length > 0) {
              updateParams.discounts = discounts
            }
            await stripe.subscriptionItems.update(existingItem.id, updateParams)
          }
        } else {
          const itemCreateParams: Stripe.SubscriptionItemCreateParams = {
            subscription: currentOrgSubscriptionId!,
            price: priceItem.price,
            proration_behavior: 'create_prorations'
          }
          
          // Only set quantity for non-metered products
          if (!isMetered) {
            itemCreateParams.quantity = priceItem.quantity
          }
          
          if (discounts.length > 0) {
            itemCreateParams.discounts = discounts
          }
          await stripe.subscriptionItems.create(itemCreateParams)
        }
        
        if (productKey) {
          if (isMetered) {
            // For metered products, only add once
            productChanges.added.push(productKey)
          } else {
            // For non-metered products, add based on quantity
            const quantityToAdd = priceItem.quantity ?? 1
            for (let i = 0; i < quantityToAdd; i++) {
              productChanges.added.push(productKey)
            }
          }
        }
      }
      
      // Update subscription to maintain billing cycle anchor when adding items
      if (productChanges.added.length > 0) {
        await stripe.subscriptions.update(currentOrgSubscriptionId!, {
          billing_cycle_anchor: 'unchanged'
        })
      }
    }
  } else {
    if (remove) throw new Error(`Cannot remove products from a subscription that does not exist for organization ${organization.id}`)
    const subscriptionItems = priceItems.map(item => {
      const subscriptionItem: Stripe.SubscriptionCreateParams.Item = {
        price: item.price
      }
      // Only set quantity for non-metered products
      if (item.quantity !== undefined) {
        subscriptionItem.quantity = item.quantity
      }
      return subscriptionItem
    })
    
    // Calculate platform fee for subscription items
    let totalAmount = 0
    const subscriptionItemsWithFees = await Promise.all(subscriptionItems.map(async (item) => {
      if (item.quantity === 0 || item.price == null) {
        // Skip items with zero quantity
        return null
      }
      const price = await stripe.prices.retrieve(item.price, { stripeAccount: connectedAccountId })
      const itemAmount = (price.unit_amount || 0) * (item.quantity || 1)
      totalAmount += itemAmount
      
      const platformFeeAmount = await calculatePlatformFee(itemAmount)
      const connectedAccountAmount = calculateConnectedAccountAmount(itemAmount, platformFeeAmount)
      
      return {
        ...item,
        metadata: {
          platform_fee_amount: platformFeeAmount.toString(),
          connected_account_amount: connectedAccountAmount.toString()
        }
      }
    }))
    
    const totalPlatformFee = await calculatePlatformFee(totalAmount)
    const totalConnectedAccountAmount = calculateConnectedAccountAmount(totalAmount, totalPlatformFee)

    const startSubscriptionParams: Stripe.SubscriptionCreateParams = {
      items: subscriptionItemsWithFees.filter((item) => item !== null),
      default_payment_method: paymentMethodId,
      expand: ['latest_invoice.payment_intent'],
      customer: user.stripe_id,
      transfer_data: {
        destination: connectedAccountId // Connected account receives funds (minus application fee)
      },
      application_fee_percent: (totalPlatformFee / totalAmount) * 100, // Platform fee percentage  
      on_behalf_of: connectedAccountId, // Makes connected account settlement merchant
      metadata: {
        platform_fee_amount: totalPlatformFee.toString(),
        connected_account_amount: totalConnectedAccountAmount.toString(),
        connected_account_id: connectedAccountId,
        ...(customerLocation && { customer_location: customerLocation }),
        ...(taxCode && { tax_code: taxCode })
      }
    }
    
    // Enable automatic tax if customer location is provided
    if (customerLocation) {
      startSubscriptionParams.automatic_tax = {
        enabled: true
      }
      
      // Update customer with tax exemption info if needed
      await stripe.customers.update(user.stripe_id, {
        tax_exempt: 'none' // Can be 'none', 'exempt', or 'reverse'
      })
    }
    if (discounts.length > 0) {
      startSubscriptionParams.discounts = discounts
    }
    // NO stripeAccount parameter - subscription created on platform
    subscription = await stripe.subscriptions.create(startSubscriptionParams)
    for (const priceItem of priceItems) {
      const priceId = priceItem.price
      const productKey = productKeysByPrice[priceId]
      const isMetered = meteredPrices.has(priceId)
      
      if (productKey) {
        if (isMetered) {
          // For metered products, only add once
          productChanges.added.push(productKey)
        } else {
          // For non-metered products, add based on quantity
          const quantity = priceItem.quantity ?? 1
          for (let i = 0; i < quantity; i++) {
            productChanges.added.push(productKey)
          }
        }
      }
    }
  }
  // update the org with added/removed products
  let purchasedProducts = organization.purchased_products ?? []
  for (const productKey of productChanges.removed) {
    const firstIndexOfProduct = purchasedProducts.findIndex((pp) => pp.group_id === productKey.group_id && pp.id === productKey.id)
    if (firstIndexOfProduct !== -1) {
      purchasedProducts.splice(firstIndexOfProduct, 1)
    }
  }
  const prices: { [productId: string]: { amount: number; currency: string } } = {}
  for (const productKey of productChanges.added) {
    const stripeProduct = stripeProducts.find((p: Stripe.Product) => p.id === productKey.id)
    if (stripeProduct && prices[productKey.id] == null) {
      const price = await stripe.prices.retrieve(typeof stripeProduct.default_price === 'string' ? stripeProduct.default_price : stripeProduct.default_price?.id || '', {
        stripeAccount: connectedAccountId
      })
      prices[productKey.id] = {
        amount: price.unit_amount ?? 0,
        currency: price.currency
      }
    }
    const purchasedProduct: PurchasedProduct = {
      id: productKey.id,
      group_id: productKey.group_id,
      name: stripeProduct?.name ?? 'Unknown',
      unique_id: v4(),
      amount: prices[productKey.id]?.amount ?? 0,
      currency: prices[productKey.id]?.currency ?? 'CAD',
    }
    if (stripeProduct?.metadata) {
      purchasedProduct.metadata = stripeProduct.metadata
    }
    // set in_good_standing_until based on product recurring
    if (stripeProduct) {
      const ourProduct = products.find(p => p.id === productKey.id)
      const interval = ourProduct?.default_price_data?.recurring?.interval ?? 'month' // 'day' | 'week' | 'month' | 'year'
      const intervalCount = ourProduct?.default_price_data?.recurring?.interval_count ?? 1
      const now = Date.now()
      // in_good_standing_until is Unix timestamps
      switch (interval) {
        case 'day':
          purchasedProduct.in_good_standing_until = Math.floor(addDays(now, intervalCount).getTime() / 1000)
          break
        case 'week':
          purchasedProduct.in_good_standing_until = Math.floor(addWeeks(now, intervalCount).getTime() / 1000)
          break
        case 'month':
          purchasedProduct.in_good_standing_until = Math.floor(addMonths(now, intervalCount).getTime() / 1000)
          break
        case 'year':
          purchasedProduct.in_good_standing_until = Math.floor(addYears(now, intervalCount).getTime() / 1000)
          break
      }
    }
    purchasedProducts.push(purchasedProduct)
  }
  
  // Create purchase records for each added product
  for (const productKey of productChanges.added) {
    const stripeProduct = stripeProducts.find((p: Stripe.Product) => p.id === productKey.id)
    const ourProduct = products.find(p => p.id === productKey.id)
    
    if (stripeProduct && ourProduct) {
      const itemAmount = ourProduct.default_price_data?.unit_amount || 0
      const platformFeeAmount = await calculatePlatformFee(itemAmount)
      
      const purchase: Purchase = {
        id: v4(),
        user_id: user.id,
        product_id: productKey.id,
        product_name: stripeProduct.name,
        is_one_time: false,
        is_subscription: true,
        purchased_at: new Date().toISOString(),
        organization_id: organization.id,
        payment_method_id: paymentMethodId || '',
        amount: itemAmount,
        currency: ourProduct.default_price_data?.currency || 'CAD',
        platform_fee_amount: platformFeeAmount,
        connected_account_id: connectedAccountId,
        destination_charge_id: subscription?.id
      }
      
      await addPurchase(purchase)
    }
  }
  
  // Update subscription IDs mapping
  const updatedSubscriptionIds = { ...organization.stripe_subscription_ids }
  
  if (purchasedProducts.length === 0) {
    // Remove subscription for this account if no products remain
    delete updatedSubscriptionIds[connectedAccountId]
  } else if (subscription) {
    // Set/update subscription ID for this account
    updatedSubscriptionIds[connectedAccountId] = subscription.id
  }

  await update<Organization>({
    tableName: process.env.ORGANIZATIONS_TABLE!,
    key: { id: organization.id },
    updates: {
      purchased_products: purchasedProducts,
      stripe_subscription_ids: updatedSubscriptionIds
    }
  })
}
