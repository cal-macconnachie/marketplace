import { paymentMethodsTableName } from '@marketplace/constants'
import { PaymentMethod } from '@marketplace/types'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { get } from '../../helpers/dynamo-helpers/get'
import { rateLimitedHandler } from '../../helpers/rate-limited-handler'

export const checkPaymentMethod = rateLimitedHandler(async (event: APIGatewayProxyEvent) => {
  try {
    const {
      user_id: userId,
      id: paymentMethodId
    }: {
      user_id?: string
      id?: string
    } = event.pathParameters ?? {}
    if (!userId || !paymentMethodId) {
      return {
        statusCode: 400, body: JSON.stringify({ message: 'Missing user_id or payment method id in path parameters' })
      }
    }
    const pm = await get<PaymentMethod>({
      tableName: paymentMethodsTableName,
      key: {
        user_id: userId,
        id: paymentMethodId
      }
    })
    return {
      statusCode: 200,
      body: JSON.stringify({ status: pm?.status ?? 'not_found' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      }
    }
  } catch (error) {
    console.error('Error checking payment method:', error)
    return {
      statusCode: 500, body: JSON.stringify({ message: 'Internal Server Error' })
    }
  }
}, {
  maxRequests: 40,
  windowMs: 60000 // 40 requests per minute for polling
})