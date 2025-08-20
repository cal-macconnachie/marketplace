import { create } from '../../helpers/dynamo-helpers/create'
import { Product } from '../products'
import {
  CreateProductRequest,
  HandlerResponse,
  ProductResponse,
  CreateProductHandler
} from './types'

export const handler: CreateProductHandler = async (
  request: CreateProductRequest
): Promise<HandlerResponse<ProductResponse>> => {
  try {
    const { body } = request

    const tableName = process.env.TABLE_PRODUCTS
    if (!tableName) {
      return {
        statusCode: 500,
        error: 'TABLE_PRODUCTS environment variable not set'
      }
    }
    console.log(body)
    const key = {
      group_id: body.group_id,
      id: body.id
    }
    console.log(key)

    // Create the product in DynamoDB
    const createdProduct = await create<Product>({
      tableName,
      key,
      record: body,
      returnCreated: true
    })

    return {
      statusCode: 201,
      data: {
        message: 'Product created successfully',
        product: createdProduct
      }
    }
  } catch (error) {
    console.error('Error creating product:', error)
    return {
      statusCode: 400,
      error: 'Failed to create product',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
