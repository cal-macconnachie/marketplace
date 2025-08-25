import { query } from '../../helpers/dynamo-helpers/query'
import { Promo } from '../promos'

export interface ListCouponsRequest {
  limit?: number
  starting_after?: string
  ending_before?: string
  created?: number | { gt?: number; gte?: number; lt?: number; lte?: number }
}

export interface ListPromotionCodesRequest {
  coupon?: string
  customer?: string
  code?: string
  limit?: number
  starting_after?: string
  ending_before?: string
  created?: number | { gt?: number; gte?: number; lt?: number; lte?: number }
  active?: boolean
}

export const listPromos = async (request: { type: 'coupons' } & ListCouponsRequest | { type: 'promotion_codes' } & ListPromotionCodesRequest) => {
  try {
    if (!process.env.TABLE_PROMOS) {
      throw new Error('TABLE_PROMOS environment variable is not set')
    }

    if (request.type === 'promotion_codes') {
      const promoRequest = request as ListPromotionCodesRequest & { type: 'promotion_codes' }
      
      // Query DynamoDB for promotion codes
      const result = await query<Promo>({
        tableName: process.env.TABLE_PROMOS,
        keyConditionExpression: '#type = :type',
        expressionAttributeNames: {
          '#type': 'type'
        },
        expressionAttributeValues: {
          ':type': 'promotion_code'
        },
        limit: promoRequest.limit
      })

      // Apply additional filters if provided
      let filteredItems = result.items
      
      if (promoRequest.coupon) {
        filteredItems = filteredItems.filter(item => 
          typeof item.coupon === 'string' ? item.coupon === promoRequest.coupon : item.coupon?.id === promoRequest.coupon
        )
      }
      
      if (promoRequest.customer) {
        filteredItems = filteredItems.filter(item => item.customer === promoRequest.customer)
      }
      
      if (promoRequest.code) {
        filteredItems = filteredItems.filter(item => item.code === promoRequest.code)
      }
      
      if (promoRequest.active !== undefined) {
        filteredItems = filteredItems.filter(item => item.active === promoRequest.active)
      }

      return {
        success: true,
        data: {
          object: 'list',
          data: filteredItems,
          has_more: false,
          total_count: filteredItems.length,
          url: '/v1/promotion_codes'
        }
      }
    } else {
      const couponRequest = request as ListCouponsRequest & { type: 'coupons' }
      
      // Query DynamoDB for coupons
      const result = await query<Promo>({
        tableName: process.env.TABLE_PROMOS,
        keyConditionExpression: '#type = :type',
        expressionAttributeNames: {
          '#type': 'type'
        },
        expressionAttributeValues: {
          ':type': 'coupon'
        },
        limit: couponRequest.limit
      })

      return {
        success: true,
        data: {
          object: 'list',
          data: result.items,
          has_more: false,
          total_count: result.items.length,
          url: '/v1/coupons'
        }
      }
    }
  } catch (error) {
    console.error('Error listing coupons/promotion codes:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}