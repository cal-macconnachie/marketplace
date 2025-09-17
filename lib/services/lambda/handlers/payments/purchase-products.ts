import { APIGatewayProxyEvent } from 'aws-lambda'
import { purchaseProducts as purchaseProductsHelper } from '../../helpers/stripe/purchase-products'

export const purchaseProducts = async (event: APIGatewayProxyEvent) => {
  try {
    const {
      body,
      requestContext
    } = event
    
    // Extract IP address from request context
    const ipAddress = requestContext?.identity?.sourceIp ||
                     event.headers?.['X-Forwarded-For']?.split(',')[0]?.trim() ||
                     event.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
    const {
      userId,
      paymentMethodId,
      productKeys,
      promoCode,
      couponId,
      taxCode
    } : {
      userId: string,
      paymentMethodId?: string,
      productKeys: ({
        id: string
        group_id: string
      })[]
      promoCode?: string
      couponId?: string
      taxCode?: string
    } = JSON.parse(body ?? '{}')
    await purchaseProductsHelper({
      userId,
      paymentMethodId,
      productKeys,
      promoCode,
      couponId,
      taxCode,
      ipAddress
    })
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
