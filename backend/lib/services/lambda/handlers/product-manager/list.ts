import { APIGatewayProxyEvent } from 'aws-lambda'
import {
  query, queryAll
} from '../../helpers/dynamo-helpers/query'
import { scan } from '../../helpers/dynamo-helpers/scan'
import { Product } from '@marketplace/types'
import { rateLimitedHandler } from '../../helpers/rate-limited-handler'
import { publicProductFields } from './get'
import { productsTableName } from '@marketplace/constants'

export const listProducts = async (
  request: APIGatewayProxyEvent
) => {
  try {
    const tableName = productsTableName
    if (!tableName) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'PRODUCTS_TABLE environment variable not set'
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    const { queryStringParameters } = request
    const {
      group_id, account_id, organization_id
    } = queryStringParameters ?? {}

    let result
    if (organization_id && !group_id && !account_id) {
      // Query products for a specific organization
      result = await queryAll<Product>({
        tableName,
        indexName: 'organization_id-index',
        keyConditionExpression: 'organization_id = :organization_id',
        expressionAttributeValues: {
          ':organization_id': organization_id
        },
      })
      return {
        statusCode: 200,
        body: JSON.stringify(result),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    if (group_id) {
      // Query products for a specific group
      if (account_id) {
        // Filter by both group_id and account_id
        result = await query<Product>({
          tableName,
          keyConditionExpression: 'group_id = :group_id',
          filterExpression: 'account_id = :account_id',
          expressionAttributeValues: {
            ':group_id': group_id,
            ':account_id': account_id
          }
        })
      } else {
        // Filter by group_id only
        result = await query<Product>({
          tableName,
          keyConditionExpression: 'group_id = :group_id',
          expressionAttributeValues: {
            ':group_id': group_id
          }
        })
      }
    } else if (account_id) {
      // Scan with account_id filter when no group_id is provided
      result = await scan<Product>({
        tableName,
        filterExpression: 'account_id = :account_id',
        expressionAttributeValues: {
          ':account_id': account_id
        }
      })
    } else {
      // Scan all products when no filters are provided
      result = await scan<Product>({
        tableName
      })
    }

    return {
      statusCode: 200,
      body: JSON.stringify(result.items),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } catch (error) {
    console.error('Error listing products:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to list products',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
}

export const publicListProducts = rateLimitedHandler(async (event: APIGatewayProxyEvent) => {
  try {
    let response: {
      message: string,
      items?: Product[],
      lastEvaluatedKey?: Record<string, unknown>
    } = { message: 'Public product listing is disabled' }
    const tableName = productsTableName
    if (tableName == null) throw new Error('PRODUCTS_TABLE environment variable not set')
    const {
      exclusive_start_key: exclusiveStartKey,
      limit = 20
    } = JSON.parse(event.body || '{}')
    const responseData = await scan<Product>({
      tableName,
      filterExpression: 'is_public = :is_public',
      expressionAttributeValues: {
        ':is_public': true
      },
      exclusiveStartKey,
      limit
    })
    if (responseData.items.length > 0) response = {
      items: responseData.items.map(item => {
        const publicItem: Product = Object.fromEntries(
          Object.entries(item).filter(([key]) => publicProductFields.includes(key as keyof Product))
        ) as Product
        return publicItem
      }),
      lastEvaluatedKey: responseData.lastEvaluatedKey,
      message: 'Public products retrieved successfully'
    }
    return {
      statusCode: 200,
      body: JSON.stringify(response),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } catch (error) {
    console.error('Error in publicListProducts:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Failed to list products',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
}, {
  maxRequests: 30,
  windowMs: 60 * 1000, // 1 minute
})
