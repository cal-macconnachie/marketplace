import {
  paymentMethodsTableName,
  purchasesTableName
} from '@marketplace/constants'
import {
  PaymentMethod,
  Purchase
} from '@marketplace/types'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { get } from '../../helpers/dynamo-helpers/get'
import { query } from '../../helpers/dynamo-helpers/query'

/**
 * Get the status of a guest checkout process.
 * This endpoint is polled by the frontend after initiating guest-checkout-complete
 * to check if the payment method has been verified and purchases have been processed.
 */
export const guestCheckoutStatus = async (event: APIGatewayProxyEvent) => {
  try {
    const userId = event.pathParameters?.userId
    const cartId = event.queryStringParameters?.cartId

    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing required parameter: userId'
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    if (!cartId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing required parameter: cartId'
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    // Get all payment methods for the user to find the most recent one
    const paymentMethodsResult = await query<PaymentMethod>({
      tableName: paymentMethodsTableName!,
      keyConditionExpression: 'user_id = :userId',
      expressionAttributeValues: {
        ':userId': userId
      },
      sortOrder: 'DESC',
      limit: 1
    })

    const paymentMethod = paymentMethodsResult.items[0]

    if (!paymentMethod) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: 'No payment method found for user',
          ready: false
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    // Get all purchases for this cart
    const purchasesResult = await query<Purchase>({
      tableName: purchasesTableName!,
      keyConditionExpression: 'user_id = :userId',
      expressionAttributeValues: {
        ':userId': userId,
        ':cartId': cartId
      },
      filterExpression: 'cart_id = :cartId'
    })

    const purchases = purchasesResult.items

    // Determine if checkout is ready (payment method active and no pending purchases)
    const isPaymentMethodReady = paymentMethod.status === 'active'
    const arePurchasesReady = purchases.length > 0 && purchases.every(p => p.status !== 'pending')
    const ready = isPaymentMethodReady && arePurchasesReady

    // Check if any purchases require action
    const purchasesRequiringAction = purchases.filter(p => !!p.requires_action)

    return {
      statusCode: 200,
      body: JSON.stringify({
        paymentMethodStatus: paymentMethod.status,
        purchases: purchases.map(p => ({
          id: p.id,
          status: p.status,
          requiresAction: !!p.requires_action,
          clientSecret: p.requires_action?.client_secret,
          paymentIntentId: p.requires_action?.payment_intent_id
        })),
        ready,
        requiresAction: purchasesRequiringAction.length > 0
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }

  } catch (error) {
    console.error('Error in guest checkout status:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to get guest checkout status',
        message: (error as Error).message,
        ready: false
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
}
