import { APIGatewayProxyEvent } from 'aws-lambda'
import { PurchasedProduct } from '../products'
import { query } from '../../helpers/dynamo-helpers/query'
import { get } from '../../helpers/dynamo-helpers/get'

export const getPurchasedProducts = async (event: APIGatewayProxyEvent) => {
  try {
    const {
      organization_id: organizationId,
      user_id: userId,
      id,
      subscription_id: subscriptionId,
      limit = 30,
      last_evaluated_key: lastEvaluatedKey,
      sort_order: sortOrder = 'desc'
    } = JSON.parse(event.body ?? '{}')
    let purchasedProduct: PurchasedProduct | undefined
    if (id != null) {
      // getting a specific purchased product either by user or organization
      if (userId != null) {
        // get by user and id
        const res = await query<PurchasedProduct>({
          tableName: process.env.PURCHASED_PRODUCTS_TABLE!,
          indexName: 'user_id-index',
          keyConditionExpression: 'user_id = :userId and id = :id',
          expressionAttributeValues: {
            ':userId': userId,
            ':id': id
          }
        })
        purchasedProduct = res.items?.[0]
      } else if (organizationId != null) {
        purchasedProduct = await get<PurchasedProduct>({
          tableName: process.env.PURCHASED_PRODUCTS_TABLE!,
          key: {
            organization_id: organizationId,
            id
          }
        })
      } else {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Either user_id or organization_id must be provided when id is specified' }),
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true,
            'Content-Type': 'application/json'
          }
        }
      }
      if (purchasedProduct == null) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'Purchased product not found' }),
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true,
            'Content-Type': 'application/json'
          }
        }
      }
      return {
        statusCode: 200,
        body: JSON.stringify(purchasedProduct),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    let purchasedProducts: PurchasedProduct[] | undefined
    let filterExpression: string | undefined
    let expressionAttributeValues: Record<string, unknown> = {}
    //
    if (subscriptionId != null) {
      filterExpression = 'subscription_id = :subscriptionId'
      expressionAttributeValues = {
        ':subscriptionId': subscriptionId
      }
    }
    if (organizationId != null) {
      // get all by organization
      const res = await query<PurchasedProduct>({
        tableName: process.env.PURCHASED_PRODUCTS_TABLE!,
        keyConditionExpression: 'organization_id = :organizationId',
        expressionAttributeValues: {
          ':organizationId': organizationId,
          ...expressionAttributeValues
        },
        ...(filterExpression != null ? { filterExpression } : {}),
        limit: limit,
        exclusiveStartKey: lastEvaluatedKey,
        scanIndexForward: sortOrder === 'asc' ? true : false,
      })
      purchasedProducts = res.items
    }
    if (userId != null) {
      // get all by user
      const res = await query<PurchasedProduct>({
        tableName: process.env.PURCHASED_PRODUCTS_TABLE!,
        indexName: 'user_id-index',
        keyConditionExpression: 'user_id = :userId',
        expressionAttributeValues: {
          ':userId': userId,
          ...expressionAttributeValues
        },
        ...(filterExpression != null ? { filterExpression } : {}),
        limit: limit,
        exclusiveStartKey: lastEvaluatedKey,
        scanIndexForward: sortOrder === 'asc' ? true : false,
      })
      purchasedProducts = res.items
    }
    if (purchasedProducts == null) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Either user_id or organization_id must be provided' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    return {
      statusCode: 200,
      body: JSON.stringify(purchasedProducts),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } catch (error) {
    console.error('Error getting purchased products:', error)
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