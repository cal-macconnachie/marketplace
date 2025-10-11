import { purchaseCartsTableName } from '@marketplace/constants'
import {
  Cart
} from '@marketplace/types'
import { APIGatewayProxyHandler } from 'aws-lambda'
import { get } from '../../helpers/dynamo-helpers/get'
import { collectReceiptEmailData } from '../../helpers/emails/collect-receipt-data'
import { getUserFromEvent } from '../../helpers/get-user-from-event'

/**
 * GET /receipts/:cartId
 * Fetches receipt data for a specific cart
 */
export const getReceipt: APIGatewayProxyHandler = async (event) => {
  try {
    const cartId = event.pathParameters?.cartId

    if (!cartId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Cart ID is required'
        })
      }
    }

    // Get authenticated user
    const user = await getUserFromEvent(event)

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

    // Fetch cart
    const cart = await get<Cart>({
      tableName: purchaseCartsTableName!,
      key: {
        user_id: user.id,
        id: cartId
      }
    })

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
}
