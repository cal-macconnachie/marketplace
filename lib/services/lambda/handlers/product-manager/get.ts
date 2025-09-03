import { get } from '../../helpers/dynamo-helpers/get'
import { Product } from '../products'
import {
  GetProductRequest 
} from './types'

export const getProduct = async (
  request: GetProductRequest
) => {
  try {
    const { pathParameters } = request
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

    const tableName = process.env.TABLE_PRODUCTS
    if (!tableName) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'TABLE_PRODUCTS environment variable not set'
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

    // Get the product from DynamoDB
    const product = await get<Product>({
      tableName,
      key
    })

    if (!product) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: 'Product not found'
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        data: product
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } catch (error) {
    console.error('Error getting product:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to get product',
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
