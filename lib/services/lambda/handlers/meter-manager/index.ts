import { APIGatewayProxyEvent } from 'aws-lambda'
import { getUserByEmail } from '../../helpers/users/get-user-by-email'
import { createMeter } from './create'
import { listMeters } from './list'
import { deactivateMeter } from './deactivate'
import {
  CreateMeterRequest,
  ListMetersRequest,
  DeactivateMeterRequest
} from './types'

export const meterManager = async (event: APIGatewayProxyEvent) => {
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
        finalRes = await createMeter(body.input as CreateMeterRequest)
        break
      case 'list':
        finalRes = await listMeters(body.input as ListMetersRequest)
        break
      case 'deactivate':
        finalRes = await deactivateMeter(body.input as DeactivateMeterRequest)
        break
      default:
        return {
          statusCode: 400,
          body: JSON.stringify({ message: 'Invalid request type' }),
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
    console.error('Meter manager error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
}