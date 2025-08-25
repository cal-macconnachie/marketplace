import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult
} from 'aws-lambda'
import { handler as createProductHandler } from '../product-manager/create'
import { handler as updateProductHandler } from '../product-manager/update'
import { handler as deleteProductHandler } from '../product-manager/delete'
import { handler as listProductHandler } from '../product-manager/list'
import { handler as getProductHandler } from '../product-manager/get'
import { handler as createPromoHandler } from '../promo-manager/create'
import { handler as listPromoHandler } from '../promo-manager/list'
import { handler as updatePromoHandler } from '../promo-manager/update'
import { handler as deletePromoHandler } from '../promo-manager/delete'
import { getUserByEmail } from '../../helpers/users/get-user-by-email'

export const superAdminManagerApi = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const { body } = event
  
  try {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Content-Type': 'application/json'
    }

    // When using API Gateway Cognito authorizer, user info is in requestContext
    const cognitoIdentity = event.requestContext?.authorizer?.claims
    if (!cognitoIdentity?.email) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Unauthorized',
          message: 'Authentication required, missing user claims'
        })
      }
    }

    const userEmail = cognitoIdentity.email
    console.log('User email from Cognito claims:', userEmail)
    
    // Get user from database using email from Cognito claims
    const user = await getUserByEmail(userEmail)

    if (!user) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Unauthorized',
          message: 'User not found in database'
        })
      }
    }
    
    // Optional: Add role-based access control here
    // For example, check if user has admin role:
    if (!user.is_organization_admin || !user.organization_id) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Forbidden',
          message: 'Admin privileges required'
        })
      }
    }
    const organizationId = user.organization_id

    console.log(`Super Admin API accessed by user: ${user.email} (ID: ${user.id}) for organization: ${organizationId}`)

    // Parse the request body to get routing information
    const requestData = JSON.parse(body || '{}')
    const {
      action,
      method,
      route,
      data,
      params
    } = requestData

    // Product Management Routes
    if (route === 'products') {
      
      if (method === 'GET' && action === 'list') {
        // List all products for this organization
        const request = { 
          queryStringParameters: { 
            ...params,
            organization_id: organizationId 
          } 
        }
        const result = await listProductHandler(request)
        
        return {
          statusCode: result.statusCode,
          headers: corsHeaders,
          body: JSON.stringify(result.error ? {
            error: result.error,
            details: result.details
          } : result.data)
        }
      }
      
      if (method === 'GET' && action === 'get') {
        // Get specific product (organization scoping handled in handler)
        const request = {
          pathParameters: {
            group_id: params?.group_id,
            id: params?.id
          },
          queryStringParameters: {
            organization_id: organizationId
          }
        }
        const result = await getProductHandler(request)
        
        return {
          statusCode: result.statusCode,
          headers: corsHeaders,
          body: JSON.stringify(result.error ? {
            error: result.error,
            details: result.details
          } : result.data)
        }
      }
      
      if (method === 'POST' && action === 'create') {
        // Create new product with organization_id
        const request = { 
          body: {
            ...data,
            organization_id: organizationId
          }
        }
        const result = await createProductHandler(request)
        
        return {
          statusCode: result.statusCode,
          headers: corsHeaders,
          body: JSON.stringify(result.error ? {
            error: result.error,
            details: result.details
          } : result.data)
        }
      }
      
      if (method === 'PUT' && action === 'update') {
        // Update existing product (must belong to organization)
        const request = {
          body: {
            ...data,
            organization_id: organizationId
          },
          pathParameters: {
            group_id: params?.group_id,
            id: params?.id
          },
          queryStringParameters: {
            organization_id: organizationId
          }
        }
        const result = await updateProductHandler(request)
        
        return {
          statusCode: result.statusCode,
          headers: corsHeaders,
          body: JSON.stringify(result.error ? {
            error: result.error,
            details: result.details
          } : result.data)
        }
      }
      
      if (method === 'DELETE' && action === 'delete') {
        // Delete product (must belong to organization)
        const request = {
          pathParameters: {
            group_id: params?.group_id,
            id: params?.id
          },
          queryStringParameters: {
            organization_id: organizationId
          }
        }
        const result = await deleteProductHandler(request)
        
        return {
          statusCode: result.statusCode,
          headers: corsHeaders,
          body: JSON.stringify(result.error ? {
            error: result.error,
            details: result.details
          } : result.data)
        }
      }
    }

    // Promo Management Routes
    if (route === 'promos') {
      
      if (method === 'POST' && action === 'create') {
        // Create coupon or promotion code for this organization
        const result = await createPromoHandler({
          ...data,
          organization_id: organizationId
        })
        
        return {
          statusCode: result.success ? 200 : 400,
          headers: corsHeaders,
          body: JSON.stringify(result)
        }
      }
      
      if (method === 'POST' && action === 'list') {
        // List coupons or promotion codes for this organization
        const result = await listPromoHandler({
          ...data,
          organization_id: organizationId
        })
        
        return {
          statusCode: result.success ? 200 : 400,
          headers: corsHeaders,
          body: JSON.stringify(result)
        }
      }
      
      if (method === 'PUT' && action === 'update') {
        // Update coupon or promotion code (must belong to organization)
        const result = await updatePromoHandler({
          ...data,
          organization_id: organizationId
        })
        
        return {
          statusCode: result.success ? 200 : 400,
          headers: corsHeaders,
          body: JSON.stringify(result)
        }
      }
      
      if (method === 'DELETE' && action === 'delete') {
        // Delete coupon or deactivate promotion code (must belong to organization)
        const result = await deletePromoHandler({
          ...data,
          organization_id: organizationId
        })
        
        return {
          statusCode: result.success ? 200 : 400,
          headers: corsHeaders,
          body: JSON.stringify(result)
        }
      }
    }

    // Health check endpoint
    if (route === 'health' && method === 'GET') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          service: 'super-admin-manager-api',
          user: {
            id: user.id,
            email: user.email,
            organization_id: user.organization_id
          }
        })
      }
    }

    // Route not found
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Route not found',
        route: route,
        method: method,
        action: action,
        availableRoutes: [
          {
            route: 'products', method: 'GET', action: 'list' 
          },
          {
            route: 'products', method: 'POST', action: 'create' 
          },
          {
            route: 'products', method: 'GET', action: 'get' 
          },
          {
            route: 'products', method: 'PUT', action: 'update' 
          },
          {
            route: 'products', method: 'DELETE', action: 'delete' 
          },
          {
            route: 'promos', method: 'POST', action: 'create' 
          },
          {
            route: 'promos', method: 'POST', action: 'list' 
          },
          {
            route: 'promos', method: 'PUT', action: 'update' 
          },
          {
            route: 'promos', method: 'DELETE', action: 'delete' 
          },
          {
            route: 'health', method: 'GET' 
          }
        ]
      })
    }
    
  } catch (error) {
    console.error('Error in Super Admin Manager API:', error)
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}