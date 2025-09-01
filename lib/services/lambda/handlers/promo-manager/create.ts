import { create } from '../../helpers/dynamo-helpers/create'
import { Promo } from '../promos'

export interface CreateCouponRequest {
  name: string
  id?: string
  percent_off?: number
  amount_off?: number
  currency?: string
  duration: 'once' | 'repeating' | 'forever'
  duration_in_months?: number
  max_redemptions?: number
  redeem_by?: number
  applies_to?: {
    products?: string[]
  }
  account_id: string
}

export interface CreatePromotionCodeRequest {
  coupon: string
  code?: string
  customer?: string
  expires_at?: number
  max_redemptions?: number
  restrictions?: {
    first_time_transaction?: boolean
    minimum_amount?: number
    minimum_amount_currency?: string
  }
  account_id: string
}

export interface CreatePromoRequest extends CreateCouponRequest {
  code?: string
  customer?: string
  expires_at?: number
  promo_max_redemptions?: number
  restrictions?: {
    first_time_transaction?: boolean
    minimum_amount?: number
    minimum_amount_currency?: string
  }
}

export const createPromo = async (request: CreatePromoRequest | { type: 'promotion_code' } & CreatePromotionCodeRequest) => {
  try {
    if (!process.env.TABLE_PROMOS) {
      throw new Error('TABLE_PROMOS environment variable is not set')
    }

    if ('type' in request && request.type === 'promotion_code') {
      const promoCodeRequest = request as CreatePromotionCodeRequest & { type: 'promotion_code' }
      
      // Validate account_id is provided
      if (!('account_id' in promoCodeRequest) || !promoCodeRequest.account_id) {
        throw new Error('account_id is required for promotion code creation')
      }

      // Create DynamoDB record for promotion code that will trigger Stripe creation
      const promoRecord: Promo = {
        type: 'promotion_code',
        id: `promo_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`, // Generate temporary ID
        coupon: promoCodeRequest.coupon,
        code: promoCodeRequest.code,
        customer: promoCodeRequest.customer,
        expires_at: promoCodeRequest.expires_at,
        max_redemptions: promoCodeRequest.max_redemptions,
        restrictions: promoCodeRequest.restrictions,
        persist_update: true,
        metadata: {},
        created: Math.floor(Date.now() / 1000),
        livemode: false,
        active: true,
        account_id: (promoCodeRequest as { account_id: string }).account_id
      }

      await create({
        tableName: process.env.TABLE_PROMOS,
        key: {
          type: promoRecord.type,
          id: promoRecord.id
        },
        record: promoRecord
      })

      return {
        success: true,
        data: {
          id: promoRecord.id,
          message: 'Promotion code creation initiated'
        }
      }
    } else {
      const promoRequest = request as CreatePromoRequest
      
      if (!promoRequest.percent_off && !promoRequest.amount_off) {
        throw new Error('Either percent_off or amount_off must be specified')
      }

      if (promoRequest.percent_off && promoRequest.amount_off) {
        throw new Error('Cannot specify both percent_off and amount_off')
      }

      if (promoRequest.amount_off && !promoRequest.currency) {
        throw new Error('Currency is required when amount_off is specified')
      }

      if (promoRequest.duration === 'repeating' && !promoRequest.duration_in_months) {
        throw new Error('duration_in_months is required when duration is repeating')
      }

      // Validate account_id is provided
      if (!('account_id' in promoRequest) || !promoRequest.account_id) {
        throw new Error('account_id is required for coupon creation')
      }

      // Create DynamoDB record for coupon that will trigger Stripe creation
      const couponId = promoRequest.id || `coupon_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
      const couponRecord: Promo = {
        type: 'coupon',
        id: couponId,
        name: promoRequest.name,
        percent_off: promoRequest.percent_off,
        amount_off: promoRequest.amount_off,
        currency: promoRequest.currency,
        duration: promoRequest.duration,
        duration_in_months: promoRequest.duration_in_months,
        max_redemptions: promoRequest.max_redemptions,
        redeem_by: promoRequest.redeem_by,
        applies_to: promoRequest.applies_to,
        persist_update: true,
        metadata: {},
        created: Math.floor(Date.now() / 1000),
        livemode: false,
        times_redeemed: 0,
        valid: true,
        account_id: (promoRequest as { account_id: string }).account_id
      }

      await create({
        tableName: process.env.TABLE_PROMOS,
        key: {
          type: couponRecord.type,
          id: couponRecord.id
        },
        record: couponRecord
      })

      // If promotion code is requested, create it too
      if (promoRequest.code || promoRequest.customer || promoRequest.expires_at || promoRequest.promo_max_redemptions || promoRequest.restrictions) {
        const promoCodeRecord: Promo = {
          type: 'promotion_code',
          id: `promo_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          coupon: couponId,
          code: promoRequest.code,
          customer: promoRequest.customer,
          expires_at: promoRequest.expires_at,
          max_redemptions: promoRequest.promo_max_redemptions,
          restrictions: promoRequest.restrictions,
          persist_update: true,
          metadata: {},
          created: Math.floor(Date.now() / 1000),
          livemode: false,
          active: true,
          account_id: (promoRequest as { account_id: string }).account_id
        }

        await create({
          tableName: process.env.TABLE_PROMOS,
          key: {
            type: promoCodeRecord.type,
            id: promoCodeRecord.id
          },
          record: promoCodeRecord
        })

        return {
          success: true,
          data: {
            coupon: { id: couponRecord.id },
            promotionCode: { id: promoCodeRecord.id },
            message: 'Coupon and promotion code creation initiated'
          }
        }
      }

      return {
        success: true,
        data: {
          coupon: { id: couponRecord.id },
          message: 'Coupon creation initiated'
        }
      }
    }
  } catch (error) {
    console.error('Error creating coupon/promotion code:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}