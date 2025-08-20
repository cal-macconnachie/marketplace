import { update } from '../../helpers/dynamo-helpers/update'
import { Product } from '../products'
import {
  UpdateProductRequest,
  HandlerResponse,
  ProductResponse,
  UpdateProductHandler
} from './types'

export const handler: UpdateProductHandler = async (
  request: UpdateProductRequest
): Promise<HandlerResponse<ProductResponse>> => {
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
        error: 'group_id and id are required path parameters'
      }
    }

    // Ensure the IDs match
    if (body.group_id !== group_id || body.id !== id) {
      return {
        statusCode: 400,
        error: 'Product IDs in URL and body do not match'
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

    // Update the product in DynamoDB
    const updatedProduct = await update<Product>({
      tableName,
      key,
      updates: body,
      returnUpdated: true
    })

    return {
      statusCode: 200,
      data: {
        message: 'Product updated successfully',
        product: updatedProduct
      }
    }
  } catch (error) {
    console.error('Error updating product:', error)
    return {
      statusCode: 400,
      error: 'Failed to update product',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
