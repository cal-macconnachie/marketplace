import { APIGatewayProxyEvent } from 'aws-lambda'
import { get } from '../../helpers/dynamo-helpers/get'
import { queryAll } from '../../helpers/dynamo-helpers/query'
import { PaymentMethod } from '../payment-methods'

export const getPaymentMethods = async (event: APIGatewayProxyEvent) => {
  try {
    const {
      user_id,
      id
    } = JSON.parse(event.body ?? '{}')
    if (!user_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing user_id' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    if (id != null) {
      return {
        statusCode: 200,
        body: JSON.stringify((await get<PaymentMethod>({
          tableName: process.env.PAYMENT_METHODS_TABLE!,
          key: {
            user_id,
            id
          }
        })) ?? {}),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    return {
      statusCode: 200,
      body: JSON.stringify(await queryAll<PaymentMethod>({
        tableName: process.env.PAYMENT_METHODS_TABLE!,
        keyConditionExpression: '#userId = :userId',
        expressionAttributeNames: {
          '#userId': 'user_id'
        },
        expressionAttributeValues: {
          ':userId': user_id
        }
      })),
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