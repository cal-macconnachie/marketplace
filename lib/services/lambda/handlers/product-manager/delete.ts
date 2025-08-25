import { deleteItem } from '../../helpers/dynamo-helpers/delete'
import { get } from '../../helpers/dynamo-helpers/get'
import { Product } from '../products'
import {
  DeleteProductRequest
} from './types'

export const deleteProduct = async (
  request: DeleteProductRequest
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

    // Check if product exists before deleting
    const product = await get<Product>({
      tableName,
      key
    })

    if (!product) {
      return {
        error: 'Product not found'
      }
    }

    // Delete the product from DynamoDB
    await deleteItem({
      tableName,
      key
    })

    return {
      data: {
        message: 'Product deleted successfully',
        deletedProduct: product
      }
    }
  } catch (error) {
    console.error('Error deleting product:', error)
    return {
      error: 'Failed to delete product',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
