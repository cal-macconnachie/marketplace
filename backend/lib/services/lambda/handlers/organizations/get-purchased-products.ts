import { purchasedProductsTableName } from '@marketplace/constants'
import { PurchasedProduct } from '@marketplace/types'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { get } from '../../helpers/dynamo-helpers/get'
import { query } from '../../helpers/dynamo-helpers/query'

export const getPurchasedProducts = async (event: APIGatewayProxyEvent) => {
  try {
    const {
      organization_id: organizationId,
      user_id: userId,
      product_id: productId,
      id,
      subscription_id: subscriptionId,
      limit = 30,
      last_evaluated_key: lastEvaluatedKey,
      sort_order: sortOrder = 'desc',
      include_cancelled: includeCancelled = false
    } = JSON.parse(event.body ?? '{}')
    let purchasedProduct: PurchasedProduct | undefined
    if (id != null) {
      // getting a specific purchased product either by user or organization
      if (userId != null) {
        // get by user and id
        const res = await query<PurchasedProduct>({
          tableName: purchasedProductsTableName!,
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
          tableName: purchasedProductsTableName!,
          key: {
            organization_id: organizationId,
            id
          }
        })
      } else if (productId != null) {
        const res = await query<PurchasedProduct>({
          tableName: purchasedProductsTableName!,
          indexName: 'product_id-index',
          keyConditionExpression: 'product_id = :productId and id = :id',
          expressionAttributeValues: {
            ':productId': productId,
            ':id': id
          }
        })
        purchasedProduct = res.items?.[0]
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
    let filterExpressions: string[] = []
    let expressionAttributeValues: Record<string, unknown> = {}

    // Filter by subscription if provided
    if (subscriptionId != null) {
      filterExpressions.push('subscription_id = :subscriptionId')
      expressionAttributeValues[':subscriptionId'] = subscriptionId
    }

    // Filter out cancelled items by default
    if (!includeCancelled) {
      filterExpressions.push('attribute_not_exists(cancelled) OR cancelled <> :cancelled')
      expressionAttributeValues[':cancelled'] = true
    }

    const filterExpression = filterExpressions.length > 0 ? filterExpressions.join(' AND ') : undefined
    if (organizationId != null) {
      // get all by organization
      const res = await query<PurchasedProduct>({
        tableName: purchasedProductsTableName!,
        keyConditionExpression: 'organization_id = :organizationId',
        expressionAttributeValues: {
          ':organizationId': organizationId,
          ...expressionAttributeValues
        },
        ...(filterExpression != null ? { filterExpression } : {}),
        limit: limit,
        exclusiveStartKey: lastEvaluatedKey,
        sortOrder
      })
      purchasedProducts = res.items
    }
    if (userId != null) {
      // get all by user
      const res = await query<PurchasedProduct>({
        tableName: purchasedProductsTableName!,
        indexName: 'user_id-index',
        keyConditionExpression: 'user_id = :userId',
        expressionAttributeValues: {
          ':userId': userId,
          ...expressionAttributeValues
        },
        ...(filterExpression != null ? { filterExpression } : {}),
        limit: limit,
        exclusiveStartKey: lastEvaluatedKey,
        sortOrder
      })
      purchasedProducts = res.items
    }
    if (productId != null) {
      // get all by product
      const res = await query<PurchasedProduct>({
        tableName: purchasedProductsTableName!,
        indexName: 'product_id-index',
        keyConditionExpression: 'product_id = :productId',
        expressionAttributeValues: {
          ':productId': productId,
          ...expressionAttributeValues
        },
        ...(filterExpression != null ? { filterExpression } : {}),
        limit: limit,
        exclusiveStartKey: lastEvaluatedKey,
        sortOrder
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