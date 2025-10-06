import { APIGatewayProxyEvent } from 'aws-lambda'
import { get } from '../../helpers/dynamo-helpers/get'
import { User } from '../users'
import { update } from '../../helpers/dynamo-helpers/update'

export const setOrgAdmin = async (event: APIGatewayProxyEvent) => {
  const {
    user_id: userId,
    admin = false,
    requesting_user_id: requestingUserId,
    organization_id: organizationId
  }: {
    user_id: string
    admin: boolean
    requesting_user_id: string
    organization_id: string
  } = JSON.parse(event.body ?? '{}')
  if (userId == null || requestingUserId == null || organizationId == null) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing user_id, requesting_user_id or organization_id' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      }
    }
  }
  // ensure requesting user is admin of requested org
  const [
    requestingUser,
    requestedUser
  ] = await Promise.all([
    get<User>({
      tableName: process.env.USERS_TABLE!,
      key: { id: requestingUserId }
    }),
    get<User>({
      tableName: process.env.USERS_TABLE!,
      key: { id: userId }
    })
  ])
  if (!requestingUser) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Requesting User not found' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      }
    }
  }
  if (!requestingUser.is_organization_admin) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Requesting User is not an organization admin' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      }
    }
  }
  if (requestingUser.organization_id !== organizationId) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Requesting User is not a member of the organization' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      }
    }
  }
  if (requestedUser == null) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Requested User not found' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      }
    }
  }
  if (requestedUser.organization_id !== organizationId) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Requested User is not a member of the organization' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      }
    }
  }
  return {
    statusCode: 200,
    body: JSON.stringify(await update<User>({
      tableName: process.env.USERS_TABLE!,
      key: { id: userId },
      updates: {
        is_organization_admin: admin
      }
    })),
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true
    }
  }
}