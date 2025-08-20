import { get } from '../../helpers/dynamo-helpers/get'
import { Product } from '../products'
import {
  GetProductRequest, HandlerResponse, GetProductHandler 
} from './types'

export const handler: GetProductHandler = async (
  request: GetProductRequest
): Promise<HandlerResponse<Product>> => {
  try {
    const { pathParameters } = request
    const {
      group_id, id 
    } = pathParameters

    if (!group_id || !id) {
      return {
        statusCode: 400,
        error: 'group_id and id are required path parameters'
      }
    }

    const tableName = process.env.TABLE_PRODUCTS
    if (!tableName) {
      return {
        statusCode: 500,
        error: 'TABLE_PRODUCTS environment variable not set'
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
        error: 'Product not found'
      }
    }

    return {
      statusCode: 200,
      data: product
    }
  } catch (error) {
    console.error('Error getting product:', error)
    return {
      statusCode: 500,
      error: 'Failed to get product',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
