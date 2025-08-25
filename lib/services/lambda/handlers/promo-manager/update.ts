import Stripe from 'stripe'
import { getStripeClient } from '../../helpers/stripe/stripe-client'

export interface UpdateCouponRequest {
  id: string
  name?: string
  metadata?: Record<string, string>
}

export interface UpdatePromotionCodeRequest {
  id: string
  active?: boolean
  metadata?: Record<string, string>
}

export const updatePromos = async (request: { type: 'coupon' } & UpdateCouponRequest | { type: 'promotion_code' } & UpdatePromotionCodeRequest) => {
  try {
    const stripe = getStripeClient()

    if (request.type === 'promotion_code') {
      const promoRequest = request as UpdatePromotionCodeRequest & { type: 'promotion_code' }
      
      if (!promoRequest.id) {
        throw new Error('Promotion code ID is required')
      }

      const updateData: Stripe.PromotionCodeUpdateParams = {}
      
      if (promoRequest.active !== undefined) {
        updateData.active = promoRequest.active
      }
      
      if (promoRequest.metadata !== undefined) {
        updateData.metadata = promoRequest.metadata
      }

      const promotionCode = await stripe.promotionCodes.update(promoRequest.id, updateData)

      return {
        success: true,
        data: promotionCode
      }
    } else {
      const couponRequest = request as UpdateCouponRequest & { type: 'coupon' }
      
      if (!couponRequest.id) {
        throw new Error('Coupon ID is required')
      }

      const updateData: Stripe.CouponUpdateParams = {}
      
      if (couponRequest.name !== undefined) {
        updateData.name = couponRequest.name
      }
      
      if (couponRequest.metadata !== undefined) {
        updateData.metadata = couponRequest.metadata
      }

      const coupon = await stripe.coupons.update(couponRequest.id, updateData)

      return {
        success: true,
        data: coupon
      }
    }
  } catch (error) {
    console.error('Error updating coupon/promotion code:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}