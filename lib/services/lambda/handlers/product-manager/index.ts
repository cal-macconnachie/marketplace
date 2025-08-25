import { APIGatewayProxyEvent } from 'aws-lambda'
import { getUserByEmail } from '../../helpers/users/get-user-by-email'
import { createProduct } from './create'
import {
  CreateProductRequest, DeleteProductRequest, GetProductRequest, ListProductsRequest, UpdateProductRequest 
} from './types'
import { deleteProduct } from './delete'
import { getProduct } from './get'
import { listProducts } from './list'
import { updateProduct } from './update'

export const productManager = async (event: APIGatewayProxyEvent) => {
  // basic endpoint for product management
  try {
    const body: {
      type: string
      input: unknown
    } = JSON.parse(event.body || '{}')
    const requesterEmail = event.requestContext?.authorizer?.claims?.email
    if (!requesterEmail) {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Unauthorized' })
      }
    }
    const user = await getUserByEmail(requesterEmail)
    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'User not found' })
      }
    }
    if (!user.is_organization_admin) {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Forbidden' })
      }
    }
    let finalRes: unknown
    switch (body.type) {
      case 'create':
        finalRes = await createProduct(body.input as CreateProductRequest)
        break
      case 'delete':
        finalRes = await deleteProduct(body.input as DeleteProductRequest)
        break
      case 'get':
        finalRes = await getProduct(body.input as GetProductRequest)
        break
      case 'list':
        finalRes = await listProducts(body.input as ListProductsRequest)
        break
      case 'update':
        finalRes = await updateProduct(body.input as UpdateProductRequest)
        break
      default:
        return {
          statusCode: 400,
          body: JSON.stringify({ message: 'Invalid request' }),
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true,
            'Content-Type': 'application/json'
          }
        }
    }
    return {
      statusCode: 200,
      body: JSON.stringify(finalRes),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } catch (error) {
    console.error(error)
    return {
      statusCode: 500,
      body: JSON.stringify({ message: (error as Error).message }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
}