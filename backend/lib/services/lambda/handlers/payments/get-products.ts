import {
  APIGatewayProxyEvent, APIGatewayProxyResult 
} from 'aws-lambda'
import { get } from '../../helpers/dynamo-helpers/get'
import { Product } from '../products'
import { queryAll } from '../../helpers/dynamo-helpers/query'

export const getProducts = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {    
    const {
      group_id: groupId,
      id
    } = JSON.parse(event.body ?? '{}')
    
    // Case 1: Get specific product by group_id and id
    if (id && groupId) {
      const product = await get<Product>({
        tableName: process.env.PRODUCTS_TABLE!,
        key: {
          group_id: groupId,
          id
        }
      })
      
      return {
        statusCode: 200,
        body: JSON.stringify(product),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    
    // Case 2: Get all products in a specific group
    if (groupId) {
      const products = await queryAll<Product>({
        tableName: process.env.PRODUCTS_TABLE!,
        keyConditionExpression: 'group_id = :group_id',
        expressionAttributeValues: {
          ':group_id': groupId
        }
      })
      return {
        statusCode: 200,
        body: JSON.stringify(products),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    return {
      statusCode: 404,
      body: JSON.stringify({ message: 'Product not found' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
    
  } catch (error) {
    console.error('Error getting products:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error getting products' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
}