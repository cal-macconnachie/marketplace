import { APIGatewayProxyEvent } from 'aws-lambda'
import { create } from '../../helpers/dynamo-helpers/create'
import { Product } from '../products'

export const createProduct = async (
  request: APIGatewayProxyEvent
) => {
  try {
    const body = JSON.parse(request.body ?? '{}')

    const tableName = process.env.PRODUCTS_TABLE
    if (!tableName) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'PRODUCTS_TABLE environment variable not set' }),
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
        body: JSON.stringify({ error: 'account_id is required in product' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
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
      statusCode: 200,
      body: JSON.stringify({ createdProduct }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } catch (error) {
    console.error('Error creating product:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to create product',
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
