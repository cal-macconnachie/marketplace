import { APIGatewayProxyEvent } from 'aws-lambda'
import {
  getOrganizationUsers 
} from '../../helpers/organizations/get-organization-users'
import { get } from '../../helpers/dynamo-helpers/get'
import { User } from '../users'
import { queryAll } from '../../helpers/dynamo-helpers/query'

export const getUsers = async (event: APIGatewayProxyEvent) => {
  try {
    const {
      organization_id: organizationId,
      id,
      stripe_id: stripeId,
      email
    } = JSON.parse(event.body ?? '{}')
    if (id) return {
      statusCode: 200,
      body: JSON.stringify(await get<User>({
        tableName: process.env.USERS_TABLE!,
        key: { id }
      })),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
    if (organizationId) return {
      statusCode: 200,
      body: JSON.stringify(await getOrganizationUsers({ orgId: organizationId })),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
    if (email) {
      const users = await queryAll<User>({
        tableName: process.env.USERS_TABLE!,
        indexName: 'email-index',
        keyConditionExpression: 'email = :email',
        expressionAttributeValues: {
          ':email': email
        }
      })
      if (users == null || users.length === 0) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'User not found' }),
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true,
            'Content-Type': 'application/json'
          }
        }
      }
      return {
        statusCode: 200,
        body: JSON.stringify(users),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    if (stripeId) {
      const users = await queryAll<User>({
        tableName: process.env.USERS_TABLE!,
        indexName: 'stripe_id-index',
        keyConditionExpression: 'stripe_id = :stripe_id',
        expressionAttributeValues: {
          ':stripe_id': stripeId
        }
      })
      if (users == null || users.length === 0) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'User not found' }),
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true,
            'Content-Type': 'application/json'
          }
        }
      }
      return {
        statusCode: 200,
        body: JSON.stringify(users),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid request' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } catch (err) {
    console.error('Error occurred while fetching users:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
}
