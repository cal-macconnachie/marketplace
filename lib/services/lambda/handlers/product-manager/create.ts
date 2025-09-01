import { create } from '../../helpers/dynamo-helpers/create'
import { Product } from '../products'
import {
  CreateProductRequest
} from './types'

export const createProduct = async (
  request: CreateProductRequest
) => {
  try {
    const { body } = request

    const tableName = process.env.TABLE_PRODUCTS
    if (!tableName) {
      return {
        error: 'TABLE_PRODUCTS environment variable not set'
      }
    }
    
    // Ensure account_id is set on the product
    if (!body.account_id) {
      return {
        error: 'account_id is required for product creation'
      }
    }
    
    const key = {
      group_id: body.group_id,
      id: body.id
    }

    // Create the product in DynamoDB with account_id
    const createdProduct = await create<Product>({
      tableName,
      key,
      record: body,
      returnCreated: true
    })

    return {
      data: {
        message: 'Product created successfully',
        product: createdProduct
      }
    }
  } catch (error) {
    console.error('Error creating product:', error)
    return {
      error: 'Failed to create product',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
