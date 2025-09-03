import { APIGatewayProxyEvent } from 'aws-lambda'
import {
  query, queryAll 
} from '../../helpers/dynamo-helpers/query'
import { scan } from '../../helpers/dynamo-helpers/scan'
import { Product } from '../products'

export const listProducts = async (
  request: APIGatewayProxyEvent
) => {
  try {
    const tableName = process.env.PRODUCTS_TABLE
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
