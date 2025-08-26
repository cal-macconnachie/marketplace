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

export const manageSubscription = async ({
  promotionCode,
  couponId,
  products,
  paymentMethodId,
  user,
  organization,
  remove = false
}: {
  promotionCode?: string
  couponId?: string
  paymentMethodId?: string
  products: Product[]
  user: User
  organization: Organization
  remove: boolean
}) => {
  if (user.stripe_id == null) {
    // not a customer return
    return
  }
  // subscriptions can have many prices
  // if there is no org subscription one must be started
  // if we are removing a subscription product, we need to 1. ensure it is a part of the subscription and if it is the last item in a subscription we need to cancel the subscription instead of removing it from the sub
  const stripe = getStripeClient()
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
        const promoCode = await stripe.promotionCodes.retrieve(stripePromoId)
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
        const coupon = await stripe.coupons.retrieve(couponId)
        if (!coupon.valid) {
          throw new Error(`Coupon ${couponId} is not valid`)
        }
        discounts.push({ coupon: couponId })
      } catch {
        throw new Error(`Invalid coupon: ${couponId}`)
      }
    }
  }
  const currentOrgSubscriptionId = organization.stripe_subscription_id
  let [
    subscription,
    stripeProducts
  ] = await Promise.all([
    currentOrgSubscriptionId ? stripe.subscriptions.retrieve(currentOrgSubscriptionId) : Promise.resolve(undefined),
    Promise.all(products.map(product => stripe.products.retrieve(product.id)))
  ])
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

  if (Object.values(priceIds).some(priceId => !priceId)) {
    throw new Error(`No price found for products ${products.map(product => product.id).join(', ')}`)
  }
  const priceItems = products.reduce((acc: { price: string; quantity: number }[], product) => {
    const priceId = priceIds[product.id]
    if (!priceId) {
      throw new Error(`No price found for product ${product.id}`)
    }
    // if acc already contains price id bump the quantity
    const existingItem = acc.find(item => item.price === priceId)
    if (existingItem) {
      existingItem.quantity += 1
    } else {
      acc.push({
        price: priceId, quantity: 1 
      })
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
        if (existingItem) {
          if ((existingItem.quantity ?? 1) <= priceItem.quantity) {
            if (subscriptionItems.length === 1) {
              await stripe.subscriptions.cancel(currentOrgSubscriptionId!)
            } else {
              await stripe.subscriptionItems.del(existingItem.id)
              subscriptionItems = subscriptionItems.filter(item => item.id !== existingItem.id)
            }
          } else {
            await stripe.subscriptionItems.update(existingItem.id, {
              quantity: (existingItem.quantity ?? 1) - priceItem.quantity
            })
          }
          if (productKey) {
            for (let i = 0; i < priceItem.quantity; i++) {
              productChanges.removed.push(productKey)
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
        if (existingItem) {
          const totalPrices = (existingItem.quantity ?? 1) + priceItem.quantity
          const updateParams: Stripe.SubscriptionItemUpdateParams = {
            quantity: totalPrices
          }
          if (discounts.length > 0) {
            updateParams.discounts = discounts
          }
          await stripe.subscriptionItems.update(existingItem.id, updateParams)
        } else {
          const itemCreateParams: Stripe.SubscriptionItemCreateParams = {
            subscription: currentOrgSubscriptionId!,
            price: priceItem.price,
            quantity: priceItem.quantity,
          }
          if (discounts.length > 0) {
            itemCreateParams.discounts = discounts
          }
          await stripe.subscriptionItems.create(itemCreateParams)
        }
        if (productKey) {
          for (let i = 0; i < priceItem.quantity; i++) {
            productChanges.added.push(productKey)
          }
        }
      }
    }
  } else {
    if (remove) throw new Error(`Cannot remove products from a subscription that does not exist for organization ${organization.id}`)
    const startSubscriptionParams: Stripe.SubscriptionCreateParams = {
      items: priceItems,
      default_payment_method: paymentMethodId,
      expand: ['latest_invoice.payment_intent'],
      customer: user.stripe_id,
    }
    if (discounts.length > 0) {
      startSubscriptionParams.discounts = discounts
    }
    subscription = await stripe.subscriptions.create(startSubscriptionParams)
    for (const priceItem of priceItems) {
      const priceId = priceItem.price
      const productKey = productKeysByPrice[priceId]
      if (productKey) {
        for (let i = 0; i < priceItem.quantity; i++) {
          productChanges.added.push(productKey)
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
    const stripeProduct = stripeProducts.find(p => p.id === productKey.id)
    if (stripeProduct && prices[productKey.id] == null) {
      const price = await stripe.prices.retrieve(typeof stripeProduct.default_price === 'string' ? stripeProduct.default_price : stripeProduct.default_price?.id || '')
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
    const stripeProduct = stripeProducts.find(p => p.id === productKey.id)
    const ourProduct = products.find(p => p.id === productKey.id)
    
    if (stripeProduct && ourProduct) {
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
        amount: ourProduct.default_price_data?.unit_amount || 0,
        currency: ourProduct.default_price_data?.currency || 'CAD'
      }
      
      await addPurchase(purchase)
    }
  }
  
  await update<Organization>({
    tableName: process.env.ORGANIZATIONS_TABLE!,
    key: { id: organization.id },
    updates: {
      purchased_products: purchasedProducts,
      ...(purchasedProducts.length === 0 
        ? { stripe_subscription_id: '' } 
        : subscription ? { stripe_subscription_id: subscription.id } : {})
    }
  })
}
