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
        error: 'group_id and id are required path parameters'
      }
    }

    const tableName = process.env.TABLE_PRODUCTS
    if (!tableName) {
      return {
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
        error: 'Product not found'
      }
    }

    return {
      data: product
    }
  } catch (error) {
    console.error('Error getting product:', error)
    return {
      error: 'Failed to get product',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
