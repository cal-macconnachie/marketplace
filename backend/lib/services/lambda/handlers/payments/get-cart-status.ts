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

    // Check if any next_steps require action (3DS authentication)
    const requiresAction = (cart.next_steps?.length ?? 0) > 0

    // Build purchases array with requiresAction and clientSecret for frontend
    const purchases = Object.entries(cart.purchases || {}).map(([id, status]) => {
      const purchase: {
        id: string
        status: string
        requiresAction?: boolean
        clientSecret?: string
      } = { id, status }

      // If this purchase is pending and we have a next_step for payment action
      if (status === 'pending' && cart.next_steps && cart.next_steps.length > 0) {
        const paymentActionStep = cart.next_steps.find(step => step.type === 'payment_action_required')
        if (paymentActionStep) {
          purchase.requiresAction = true
          purchase.clientSecret = paymentActionStep.payment_intent_client_secret
        }
      }

      return purchase
    })

    if (hasPendingPurchases) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          cartStatus: 'pending',
          requiresAction,
          purchases,
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