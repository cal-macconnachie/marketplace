import { paymentMethodsTableName } from '@marketplace/constants'
import {
  PaymentMethod, QueryAllInput
} from '@marketplace/types'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { get } from '../../helpers/dynamo-helpers/get'
import {
  queryAll
} from '../../helpers/dynamo-helpers/query'

export const getPaymentMethods = async (event: APIGatewayProxyEvent) => {
  try {
    const {
      user_id,
      id,
      include_archived = false
    } = JSON.parse(event.body ?? '{}')
    if (id != null) {
      return {
        statusCode: 200,
        body: JSON.stringify((await get<PaymentMethod>({
          tableName: paymentMethodsTableName!,
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
    if (user_id) {
      const params: QueryAllInput = {
        tableName: paymentMethodsTableName!,
        keyConditionExpression: '#userId = :userId',
        expressionAttributeNames: {
          '#userId': 'user_id',
        },
        expressionAttributeValues: {
          ':userId': user_id,
        }
      }
      if (!include_archived) {
        params.filterExpression = 'attribute_not_exists(archived) OR archived = :archived'
        if (params.expressionAttributeValues == null) {
          params.expressionAttributeValues = {}
        }
        params.expressionAttributeValues[':archived'] = false
      }
      return {
        statusCode: 200,
        body: JSON.stringify(await queryAll<PaymentMethod>(params)),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'User ID not provided' }),
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