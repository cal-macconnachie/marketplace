import { purchaseCartsTableName } from '@marketplace/constants'
import { Cart } from '@marketplace/types'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { get } from '../../helpers/dynamo-helpers/get'
import { rateLimitedHandler } from '../../helpers/rate-limited-handler'

export const getCartStatus = rateLimitedHandler(async (event: APIGatewayProxyEvent) => {
  try {
    const {
      cart_id: cartId, user_id: userId 
    } = event.pathParameters ?? {}
    if (!cartId || !userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'cart_id and user_id are required in path parameters' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    const cart = await get<Cart>({
      tableName: purchaseCartsTableName,
      key: {
        user_id: userId,
        id: cartId
      }
    })
    if (!cart) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Cart not found' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    const next = cart.next_steps?.length ? cart.next_steps : undefined
    const hasPendingPurchases = Object.values(cart.purchases || {}).some(status => status === 'pending')
    if (hasPendingPurchases) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          cartStatus: 'pending',
          next
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    const hasFailedPurchases = Object.values(cart.purchases || {}).some(status => status === 'failed')
    const allFailed = Object.values(cart.purchases || {}).every(status => status === 'failed')
    if (allFailed) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: false,
          cartStatus: 'failed',
          next
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    if (hasFailedPurchases) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          cartStatus: 'failed',
          next
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        cartStatus: 'succeeded',
        next
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } catch (error) {
    console.error('Error getting cart status:', error)
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
}, {
  maxRequests: 40,
  windowMs: 60000 // 40 requests per minute for polling
})