import { APIGatewayProxyEvent } from 'aws-lambda'
import { rateLimitedHandler } from '../../helpers/rate-limited-handler'
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
    const res = await purchaseProductsHelper({
      userId,
      paymentMethodId,
      productKeys,
      promoCode,
      couponId,
      ipAddress
    })
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        cartId: res.cartId,
        meteredCartItems: res.meteredCartIds,
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } catch (error) {
    console.error('Error purchasing products:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: (error as Error).message }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
}

export const publicPurchaseProducts = rateLimitedHandler(purchaseProducts, {
  windowMs: 60 * 1000, // 1 minute window
  maxRequests: 3 // 3 purchases per minute (stricter for payment operations)
})
