import { APIGatewayProxyEvent } from 'aws-lambda'
import { deleteItem } from '../../helpers/dynamo-helpers/delete'
import { get } from '../../helpers/dynamo-helpers/get'
import { Product } from '@marketplace/types'
import { productsTableName } from '@marketplace/constants'

export const deleteProduct = async (
  request: APIGatewayProxyEvent
) => {
  try {
    const { pathParameters } = request
    const {
      group_id, id 
    } = pathParameters ?? {}

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

    const tableName = productsTableName
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

    // Check if product exists before deleting
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

    // Delete the product from DynamoDB
    await deleteItem({
      tableName,
      key
    })

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Product deleted successfully',
        deletedProduct: product
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } catch (error) {
    console.error('Error deleting product:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to delete product',
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
