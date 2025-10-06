import { APIGatewayProxyEvent } from 'aws-lambda'
import { query } from '../../helpers/dynamo-helpers/query'
import { Promo } from '../promos'

export interface ListCouponsRequest {
  limit?: number
  starting_after?: string
  ending_before?: string
  created?: number | { gt?: number; gte?: number; lt?: number; lte?: number }
  account_id?: string
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
  account_id?: string
}

export const listPromos = async (request: APIGatewayProxyEvent) => {
  try {
    if (!process.env.PROMOS_TABLE) {
      throw new Error('PROMOS_TABLE environment variable is not set')
    }

    const body = JSON.parse(request.body ?? '{}')

    if (body.type === 'promotion_codes') {
      const promoRequest = body as ListPromotionCodesRequest & { type: 'promotion_codes' }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const queryParams: any = {
        tableName: process.env.PROMOS_TABLE,
        keyConditionExpression: '#type = :type',
        expressionAttributeNames: {
          '#type': 'type'
        },
        expressionAttributeValues: {
          ':type': 'promotion_code'
        },
        limit: promoRequest.limit
      }

      // Add account_id filter if provided
      if (promoRequest.account_id) {
        queryParams.filterExpression = 'account_id = :account_id'
        queryParams.expressionAttributeValues[':account_id'] = promoRequest.account_id
      }

      const result = await query<Promo>(queryParams)

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
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          data: {
            object: 'list',
            data: filteredItems,
            has_more: false,
            total_count: filteredItems.length,
            url: '/v1/promotion_codes'
          }
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    } else {
      const couponRequest = body as ListCouponsRequest

      // Query DynamoDB for coupons
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const queryParams: any = {
        tableName: process.env.PROMOS_TABLE,
        keyConditionExpression: '#type = :type',
        expressionAttributeNames: {
          '#type': 'type'
        },
        expressionAttributeValues: {
          ':type': 'coupon'
        },
        limit: couponRequest.limit
      }

      // Add account_id filter if provided
      if (couponRequest.account_id) {
        queryParams.filterExpression = 'account_id = :account_id'
        queryParams.expressionAttributeValues[':account_id'] = couponRequest.account_id
      }

      const result = await query<Promo>(queryParams)

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          data: {
            object: 'list',
            data: result.items,
            has_more: false,
            total_count: result.items.length,
            url: '/v1/coupons'
          }
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
  } catch (error) {
    console.error('Error listing coupons/promotion codes:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to list coupons/promotion codes',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
}