import {
  purchaseCartsTableName, usersTableName
} from '@marketplace/constants'
import {
  Cart,
  User
} from '@marketplace/types'
import { APIGatewayProxyHandler } from 'aws-lambda'
import { get } from '../../helpers/dynamo-helpers/get'
import { collectReceiptEmailData } from '../../helpers/emails/collect-receipt-data'
import { rateLimitedHandler } from '../../helpers/rate-limited-handler'

/**
 * GET /receipts/:cartId/:userId
 * Fetches receipt data for a specific cart
 */
export const getReceipt: APIGatewayProxyHandler = rateLimitedHandler(async (event) => {
  try {
    const cartId = event.pathParameters?.cartId
    const userId = event.pathParameters?.userId

    if (!cartId || !userId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Cart ID and User ID are required'
        })
      }
    }

    // Fetch user and cart in parallel for better performance
    const [
      user,
      cart
    ] = await Promise.all([
      get<User>({
        tableName: usersTableName,
        key: { id: userId! }
      }),
      get<Cart>({
        tableName: purchaseCartsTableName!,
        key: {
          user_id: userId!,
          id: cartId
        }
      })
    ])

    if (!user) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Unauthorized'
        })
      }
    }

    if (!cart) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Receipt not found'
        })
      }
    }

    // Verify cart belongs to user
    if (cart.user_id !== user.id) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'You do not have permission to view this receipt'
        })
      }
    }

    // Collect receipt data using the same logic as email receipts
    const receiptData = await collectReceiptEmailData({
      user,
      cart
    })

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(receiptData)
    }
  } catch (error) {
    console.error('Error fetching receipt:', error)
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Failed to fetch receipt',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}, {
  windowMs: 60 * 1000, // 1 minute window
  maxRequests: 20 // 20 receipt views per minute (moderate limit for read operation)
})
