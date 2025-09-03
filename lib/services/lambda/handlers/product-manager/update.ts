import { update } from '../../helpers/dynamo-helpers/update'
import { Product } from '../products'
import {
  UpdateProductRequest
} from './types'

export const updateProduct = async (
  request: UpdateProductRequest
) => {
  try {
    const {
      body, pathParameters 
    } = request
    const {
      group_id, id 
    } = pathParameters

    if (!group_id || !id) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'group_id and id are required path parameters'
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    // Ensure the IDs match
    if (body.group_id !== group_id || body.id !== id) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Product IDs in URL and body do not match'
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    // Ensure account_id is set on the product
    if (!body.account_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'account_id is required for product updates'
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

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

    const key = {
      group_id: group_id,
      id
    }

    // Update the product in DynamoDB
    const updatedProduct = await update<Product>({
      tableName,
      key,
      updates: body,
      returnUpdated: true
    })

    return {
      statusCode: 200,
      body: JSON.stringify(updatedProduct),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } catch (error) {
    console.error('Error updating product:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to update product',
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
