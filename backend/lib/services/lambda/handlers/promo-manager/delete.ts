import { APIGatewayProxyEvent } from 'aws-lambda'
import { deleteItem } from '../../helpers/dynamo-helpers/delete'

export interface DeleteCouponRequest {
  id: string
}

export interface DeletePromotionCodeRequest {
  id: string
}

export const deletePromo = async (request: APIGatewayProxyEvent) => {
  try {
    if (!process.env.PROMOS_TABLE) {
      throw new Error('PROMOS_TABLE environment variable is not set')
    }

    const body = JSON.parse(request.body ?? '{}')

    if (body.type === 'promotion_code') {
      const promoRequest = body as DeletePromotionCodeRequest & { type: 'promotion_code' }

      if (!promoRequest.id) {
        throw new Error('Promotion code ID is required')
      }

      // Delete DynamoDB record which will trigger Stripe deletion
      await deleteItem({
        tableName: process.env.PROMOS_TABLE,
        key: {
          type: 'promotion_code',
          id: promoRequest.id
        }
      })

      return {
        statusCode: 204,
        body: JSON.stringify({
          id: promoRequest.id,
          message: 'Promotion code deletion initiated'
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    } else {
      const couponRequest = body as DeleteCouponRequest

      if (!couponRequest.id) {
        throw new Error('Coupon ID is required')
      }

      // Delete DynamoDB record which will trigger Stripe deletion
      await deleteItem({
        tableName: process.env.PROMOS_TABLE,
        key: {
          type: 'coupon',
          id: couponRequest.id
        }
      })

      return {
        statusCode: 204,
        body: JSON.stringify({
          id: couponRequest.id,
          message: 'Coupon deletion initiated'
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
  } catch (error) {
    console.error('Error deleting coupon/promotion code:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to delete coupon/promotion code',
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