import { Organization } from '../../handlers/organizations'
import { Product } from '../../handlers/products'
import { Purchase } from '../../handlers/purchases'
import { User } from '../../handlers/users'
import { getPromoByCode } from './get-promo-by-code'
import { getStripeClient } from './stripe-client'
import { v4 } from 'uuid'
import { calculatePlatformFee } from './calculate-platform-fee'
import {
  calculateTaxesWithCaching, ItemsInterface 
} from '../tax/calculate-taxes-with-caching'
import { generateLocationKey } from '../tax/tax-calculation-cache'

export const createSubscriptionPurchase = async ({
  promotionCode,
  couponId,
  product,
  paymentMethodId,
  user,
  organization,
  sellerOrganization,
  taxCode,
  ipAddress,
  cartId
}: {
  promotionCode?: string
  couponId?: string
  paymentMethodId?: string
  product: Product
  user: User
  organization: Organization
  sellerOrganization: Organization
  taxCode?: string
  ipAddress?: string
  cartId: string
}): Promise<Purchase> => {
  const stripe = getStripeClient()

  if (!organization) {
    throw new Error(`Organization not found for user ${user.id}`)
  }

  // Check if organization has existing subscription for this product's account
  const existingSubscriptionId = organization.stripe_subscription_ids?.[product.account_id]
  let isAddingToExistingSubscription = false
  let proratedAmount = product.default_price_data.unit_amount

  if (existingSubscriptionId) {
    try {
      // Get existing subscription details to calculate prorated amount
      const existingSubscription = await stripe.subscriptions.retrieve(existingSubscriptionId)

      if (existingSubscription.status === 'active' || existingSubscription.status === 'trialing') {
        isAddingToExistingSubscription = true

        // Calculate prorated amount based on remaining billing period
        // Use the first subscription item's billing period (most subscriptions have one item)
        const firstItem = existingSubscription.items?.data?.[0]
        if (firstItem?.current_period_end && firstItem?.current_period_start) {
          const now = Math.floor(Date.now() / 1000)
          const currentPeriodEnd = firstItem.current_period_end
          const currentPeriodStart = firstItem.current_period_start
          const totalPeriodLength = currentPeriodEnd - currentPeriodStart
          const remainingPeriodLength = currentPeriodEnd - now

          if (remainingPeriodLength > 0 && totalPeriodLength > 0) {
            const proratedFactor = remainingPeriodLength / totalPeriodLength
            proratedAmount = Math.floor(product.default_price_data.unit_amount * proratedFactor)
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to retrieve existing subscription ${existingSubscriptionId}:`, error)
      // Continue with full amount if subscription lookup fails
    }
  }

  // Calculate discount amount if promotion code or coupon is provided
  let discountAmount = 0
  let originalAmount = proratedAmount
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

  // For new subscriptions, ensure minimum charge amount (prorated amounts can be smaller)
  if (!isAddingToExistingSubscription) {
    const minimumAmount = 100 // 100 cents in most currencies
    if (finalAmount < minimumAmount) {
      finalAmount = minimumAmount
      discountAmount = originalAmount - finalAmount
    }
  }

  // Calculate tax using our cached tax helper
  const customerLocation = generateLocationKey(user, ipAddress)
  const taxItem: ItemsInterface = {
    id: product.id,
    group_id: product.group_id,
    organization_id: organization.id,
    quantity: 1
  }

  const modifiedProduct = {
    ...product,
    default_price_data: {
      ...product.default_price_data,
      unit_amount: finalAmount
    },
    ...(taxCode ? { tax_code: taxCode } : {})
  }

  const productsHash = {
    [`${product.group_id}:${product.id}`]: modifiedProduct
  }

  const orgsHash = {
    [sellerOrganization.id]: sellerOrganization
  }

  const taxResult = await calculateTaxesWithCaching(
    [taxItem],
    productsHash,
    orgsHash,
    customerLocation
  )

  const taxAmount = taxResult.items[0]?.tax_amount || 0
  const totalAmount = finalAmount + taxAmount

  // Calculate platform fee on the post-tax total
  const platformFeeAmount = await calculatePlatformFee({
    amount: totalAmount, organizationId: organization.id
  })

  const purchaseData: Purchase = {
    id: v4(),
    cart_id: cartId,
    user_id: user.id,
    product_id: product.id,
    product_group_id: product.group_id,
    organization_id: user.organization_id,
    purchased_at: new Date().toISOString(),
    is_one_time: false,
    is_subscription: true,
    payment_method_id: paymentMethodId!,
    product_name: product.name,
    amount: totalAmount, // Total amount including tax (full subscription or prorated)
    currency: product.default_price_data.currency,
    platform_fee_amount: platformFeeAmount,
    connected_account_id: product.account_id,
    tax_amount: taxAmount,
    base_amount: finalAmount, // Amount before tax (full subscription or prorated)
    applied_discount: appliedDiscount ? {
      type: appliedDiscount.type === 'promotion_code' ? 'promotion_code' : 'coupon' as 'coupon' | 'promotion_code',
      code: appliedDiscount.code,
      coupon: {
        id: appliedDiscount.coupon?.id,
        amount_off: appliedDiscount.coupon?.amount_off || 0,
        percent_off: appliedDiscount.coupon?.percent_off || 0
      }
    } : undefined,
    seller_organization_id: product.metadata?.organization_id,
    status: 'pending'
  }

  return purchaseData
}