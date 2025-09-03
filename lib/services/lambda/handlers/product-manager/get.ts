import { APIGatewayProxyEvent } from 'aws-lambda'
import { get } from '../../helpers/dynamo-helpers/get'
import { Product } from '../products'

export const publicGetProduct = async (event: APIGatewayProxyEvent) => {
  try {
    const { pathParameters } = event
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
    const publicProductFields: (keyof Product)[] = [
      'id',
      'name',
      'description',
      'group_id',
      'default_price_data',
      'images',
      'marketing_features'
    ]
    // remove all fields from product that arent public
    const publicProduct = Object.fromEntries(
      Object.entries(product).filter(([key]) => publicProductFields.includes(key as keyof Product))
    )

    return {
      statusCode: 200,
      body: JSON.stringify(publicProduct),
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

export const getProduct = async (
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
