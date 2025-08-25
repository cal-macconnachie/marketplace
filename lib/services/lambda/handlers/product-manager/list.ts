import { query } from '../../helpers/dynamo-helpers/query'
import { scan } from '../../helpers/dynamo-helpers/scan'
import { Product } from '../products'
import {
  ListProductsRequest 
} from './types'

export const listProducts = async (
  request: ListProductsRequest
) => {
  try {
    const tableName = process.env.TABLE_PRODUCTS
    if (!tableName) {
      return {
        error: 'TABLE_PRODUCTS environment variable not set'
      }
    }

    const { queryStringParameters } = request
    const { group_id } = queryStringParameters || {}

    if (group_id) {
      // Query products for a specific group
      const result = await query<Product>({
        tableName,
        keyConditionExpression: 'group_id = :group_id',
        expressionAttributeValues: {
          ':group_id': group_id
        }
      })

      return {
        data: result.items
      }
    } else {
      // Scan all products when no group_id is provided
      const result = await scan<Product>({
        tableName
      })

      return {
        data: result.items
      }
    }
  } catch (error) {
    console.error('Error listing products:', error)
    return {
      error: 'Failed to list products',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
