import {
  Product, PurchasedProduct 
} from "../../handlers/products"
import { User } from "../../handlers/users"
import { getPromoByCode } from "./get-promo-by-code"
import { getStripeClient } from "./stripe-client"
import { update } from "../dynamo-helpers/update"
import { Organization } from "../../handlers/organizations"
import { addPurchase } from '../add-purchase'
import { v4 } from 'uuid'
import { clonePaymentMethodToConnectedAccount } from './clone-payment-method'

export const createOneTimePayment = async ({
  promotionCode,
  couponId,
  product,
  paymentMethodId,
  user,
  organization
}: {
  promotionCode?: string
  couponId?: string
  paymentMethodId?: string
  product: Product
  user: User
  organization: Organization
}) => {
  const stripe = getStripeClient()
  // Implementation for creating a one-time payment using Stripe API
  // Use connected account when retrieving product
  const [stripeProduct] = await Promise.all([
    stripe.products.retrieve(product.id, {
      stripeAccount: product.account_id
    })
  ])
  const priceId = typeof stripeProduct.default_price === 'string' ? stripeProduct.default_price : stripeProduct.default_price?.id

  if (!priceId) {
    throw new Error(`No price_id found for product ${product.id}`)
  }
  if (!organization) {
    throw new Error(`Organization not found for user ${user.id}`)
  }

  // Calculate discount amount if promotion code or coupon is provided
  let discountAmount = 0
  let originalAmount = product.default_price_data.unit_amount
  let finalAmount = originalAmount
  let appliedDiscount = null

  if (promotionCode || couponId) {
    try {
      let discount = null
      
      if (promotionCode) {
        // Look up promotion code in database to get the actual Stripe promotion code ID
        const promoRecord = await getPromoByCode(promotionCode)
        if (!promoRecord || promoRecord.type !== 'promotion_code') {
          throw new Error(`Promotion code ${promotionCode} not found`)
        }
        
        // Use stripeId if available, fallback to id for backwards compatibility
        const stripePromoId = promoRecord.stripeId || promoRecord.id
        
        // Validate and retrieve promotion code from Stripe
        const promoCode = await stripe.promotionCodes.retrieve(stripePromoId, {
          stripeAccount: product.account_id
        })
        if (!promoCode.active) {
          throw new Error(`Promotion code ${promotionCode} is not active`)
        }
        discount = promoCode.coupon
        appliedDiscount = {
          type: 'promotion_code', code: promotionCode, coupon: discount 
        }
      } else if (couponId) {
        // Validate and retrieve coupon
        discount = await stripe.coupons.retrieve(couponId, {
          stripeAccount: product.account_id
        })
        if (!discount.valid) {
          throw new Error(`Coupon ${couponId} is not valid`)
        }
        appliedDiscount = {
          type: 'coupon', coupon: discount 
        }
      }

      if (discount) {
        // Calculate discount amount based on coupon type
        if (discount.percent_off) {
          discountAmount = Math.round((originalAmount * discount.percent_off) / 100)
        } else if (discount.amount_off && discount.currency === product.default_price_data.currency) {
          discountAmount = discount.amount_off
        }
        
        // Ensure discount doesn't exceed original amount
        discountAmount = Math.min(discountAmount, originalAmount)
        finalAmount = Math.max(originalAmount - discountAmount, 0)
      }
    } catch (error) {
      throw new Error(`Invalid discount code: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Ensure minimum charge amount (Stripe requires at least 50 cents for most currencies)
  const minimumAmount = 50 // 50 cents in most currencies
  if (finalAmount < minimumAmount) {
    finalAmount = minimumAmount
    discountAmount = originalAmount - finalAmount
  }

  // Clone payment method and customer to connected account if needed
  let effectivePaymentMethodId = paymentMethodId
  let effectiveCustomerId = user.stripe_id
  if (product.account_id && paymentMethodId) {
    try {
      const cloned = await clonePaymentMethodToConnectedAccount({
        paymentMethodId,
        user,
        connectedAccountId: product.account_id
      })
      effectivePaymentMethodId = cloned.paymentMethodId
      effectiveCustomerId = cloned.customerId
    } catch (cloneError) {
      console.error(`Failed to clone payment method for connected account: ${cloneError}`)
      throw new Error(`Payment method not compatible with merchant account`)
    }
  }

  // Create a PaymentIntent for one-time payment
  const paymentIntent = await stripe.paymentIntents.create({
    amount: finalAmount,
    currency: product.default_price_data.currency,
    customer: effectiveCustomerId,
    payment_method: effectivePaymentMethodId,
    metadata: {
      userId: user.id,
      productId: product.id,
      productGroupId: product.group_id,
      type: 'one_time_payment',
      original_amount: originalAmount.toString(),
      discount_amount: discountAmount.toString(),
      ...(appliedDiscount && {
        discount_type: appliedDiscount.type,
        discount_code: appliedDiscount.code || appliedDiscount.coupon.id
      })
    },
    automatic_payment_methods: {
      enabled: true,
      allow_redirects: 'never'
    }
  }, {
    stripeAccount: product.account_id
  })

  if (!paymentIntent) {
    throw new Error('Failed to create payment intent')
  }
  const confirmedPaymentIntent = await stripe.paymentIntents.confirm(paymentIntent.id, {}, {
    stripeAccount: product.account_id
  })
  if (confirmedPaymentIntent.status !== 'succeeded') {
    return {
      success: false,
      message: `Payment failed with status: ${confirmedPaymentIntent.status}`,
      paymentIntentId: paymentIntent.id,
      next: confirmedPaymentIntent.next_action
    }
  }
  const purchasedProduct: PurchasedProduct = {
    id: product.id,
    group_id: product.group_id,
    name: product.name,
    metadata: product.metadata,
    unique_id: confirmedPaymentIntent.id,
    user_id: user.id,
    amount: finalAmount,
    currency: product.default_price_data.currency
  }
  // Calculate expiration time based on product metadata 'time' field or default to 1 hour
  const currentTime = Math.floor(Date.now() / 1000) // Use seconds to match Stripe format
  
  // Check if product has a 'time' metadata field (still in seconds from metadata)
  let durationInSeconds = 60 * 60 // Default to 1 hour (3600 seconds)
  
  if (product.metadata?.time) {
    const timeValue = parseInt(product.metadata.time, 10)
    // Validate time value: must be positive and not exceed 100 years (3155673600 seconds)
    const maxDuration = 3155673600 // 100 years in seconds
    if (!isNaN(timeValue) && timeValue > 0 && timeValue <= maxDuration) {
      durationInSeconds = timeValue
    }
    const expirationTime = currentTime + durationInSeconds
    purchasedProduct.in_good_standing_until = expirationTime
  }
  await update<Organization>({
    tableName: process.env.ORGANIZATIONS_TABLE!,
    key: {
      id: user.organization_id
    },
    updates: {
      purchased_products: (organization.purchased_products ?? []).concat([purchasedProduct])
    }
  })
  await addPurchase({
    id: v4(),
    user_id: user.id,
    product_id: product.id,
    organization_id: user.organization_id,
    purchased_at: new Date().toISOString(),
    is_one_time: true,
    is_subscription: false,
    payment_method_id: paymentMethodId!,
    product_name: product.name,
    amount: finalAmount,
    currency: product.default_price_data.currency
  })
  return {
    success: true,
    message: 'One-time payment successful',
    paymentIntentId: confirmedPaymentIntent.id,
    purchasedProduct
  }
}
