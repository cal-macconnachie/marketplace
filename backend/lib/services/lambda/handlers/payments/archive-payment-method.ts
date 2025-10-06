import { APIGatewayProxyEvent } from 'aws-lambda'
import { get } from '../../helpers/dynamo-helpers/get'
import { PaymentMethod } from '../payment-methods'
import { update } from '../../helpers/dynamo-helpers/update'

export const archivePaymentMethod = async (event: APIGatewayProxyEvent) => {
  try {
    const {
      user_id, id 
    } = JSON.parse(event.body ?? '{}')
    if (!user_id || !id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'User ID and Payment Method ID are required' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    const paymentMethod = await get<PaymentMethod>({
      tableName: process.env.PAYMENT_METHODS_TABLE!,
      key: {
        user_id,
        id
      }
    })
    if (!paymentMethod) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Payment Method not found' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    await update<PaymentMethod>({
      tableName: process.env.PAYMENT_METHODS_TABLE!,
      key: {
        user_id,
        id
      },
      updates: {
        archived: true
      }
    })
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Payment Method archived successfully' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } catch (error) {
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