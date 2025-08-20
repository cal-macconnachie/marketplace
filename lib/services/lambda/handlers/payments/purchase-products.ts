import { APIGatewayProxyEvent } from 'aws-lambda'
import { purchaseProducts as purchaseProductsHelper } from '../../helpers/stripe/purchase-products'

export const purchaseProducts = async (event: APIGatewayProxyEvent) => {
  try {
    const {
      body
    } = event
    const {
      userId,
      paymentMethodId,
      productKeys,
      promoCode,
      couponId
    } : {
      userId: string,
      paymentMethodId?: string,
      productKeys: ({
        id: string
        group_id: string
      })[]
      promoCode?: string
      couponId?: string
    } = JSON.parse(body ?? '{}')
    try {
      await purchaseProductsHelper({
        userId,
        paymentMethodId,
        productKeys,
        promoCode,
        couponId
      })
    } catch (error) {
      console.error(`Error purchasing products for user ${userId}:`, error)
    }
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } catch {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to purchase products' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
}
