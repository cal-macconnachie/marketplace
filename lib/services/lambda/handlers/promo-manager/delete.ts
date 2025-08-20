import { deleteItem } from '../../helpers/dynamo-helpers/delete'

export interface DeleteCouponRequest {
  id: string
}

export interface DeletePromotionCodeRequest {
  id: string
}

export const handler = async (request: { type: 'coupon' } & DeleteCouponRequest | { type: 'promotion_code' } & DeletePromotionCodeRequest) => {
  try {
    if (!process.env.TABLE_PROMOS) {
      throw new Error('TABLE_PROMOS environment variable is not set')
    }

    if (request.type === 'promotion_code') {
      const promoRequest = request as DeletePromotionCodeRequest & { type: 'promotion_code' }
      
      if (!promoRequest.id) {
        throw new Error('Promotion code ID is required')
      }

      // Delete DynamoDB record which will trigger Stripe deletion
      await deleteItem({
        tableName: process.env.TABLE_PROMOS,
        key: {
          type: 'promotion_code',
          id: promoRequest.id
        }
      })

      return {
        success: true,
        data: { id: promoRequest.id },
        message: 'Promotion code deletion initiated'
      }
    } else {
      const couponRequest = request as DeleteCouponRequest & { type: 'coupon' }
      
      if (!couponRequest.id) {
        throw new Error('Coupon ID is required')
      }

      // Delete DynamoDB record which will trigger Stripe deletion
      await deleteItem({
        tableName: process.env.TABLE_PROMOS,
        key: {
          type: 'coupon',
          id: couponRequest.id
        }
      })

      return {
        success: true,
        data: { id: couponRequest.id },
        message: 'Coupon deletion initiated'
      }
    }
  } catch (error) {
    console.error('Error deleting coupon/promotion code:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}