import {
  APIGatewayProxyEvent, APIGatewayProxyResult 
} from 'aws-lambda'
import { get } from '../../helpers/dynamo-helpers/get'
import { Product } from '../products'
import { queryAll } from '../../helpers/dynamo-helpers/query'
import { getUserFromToken } from '../../helpers/get-user-from-auth-token'

export const getProducts = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Get user from authentication token
    const authHeader = event.headers?.Authorization || event.headers?.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Authentication required, missing Auth Header' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    const accessToken = authHeader.split(' ')[1]
    console.log('Auth Header found, proceeding to get user from token', accessToken)
    const user = await getUserFromToken(accessToken)
    
    if (!user || !user.organization_id) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Invalid authentication or missing organization' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    const organizationId = user.organization_id
    
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
      
      // Check if product belongs to user's organization
      if (!product || product.organization_id !== organizationId) {
        return {
          statusCode: 404,
          body: JSON.stringify({ message: 'Product not found' }),
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true,
            'Content-Type': 'application/json'
          }
        }
      }
      
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
    
    // Case 2: Get all products in a specific group (filtered by organization)
    if (groupId) {
      const products = await queryAll<Product>({
        tableName: process.env.PRODUCTS_TABLE!,
        keyConditionExpression: 'group_id = :group_id',
        expressionAttributeValues: {
          ':group_id': groupId
        }
      })
      
      // Filter products to only include those from user's organization
      const organizationProducts = products.filter(product => product.organization_id === organizationId)
      
      return {
        statusCode: 200,
        body: JSON.stringify(organizationProducts),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    
    // Case 3: Get all products for user's organization using GSI
    const allProducts = await queryAll<Product>({
      tableName: process.env.PRODUCTS_TABLE!,
      indexName: 'organization_id-index',
      keyConditionExpression: 'organization_id = :organization_id',
      expressionAttributeValues: {
        ':organization_id': organizationId
      }
    })
    
    return {
      statusCode: 200,
      body: JSON.stringify(allProducts),
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