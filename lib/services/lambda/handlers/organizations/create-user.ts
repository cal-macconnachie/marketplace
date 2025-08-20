import { APIGatewayProxyEvent } from 'aws-lambda'
import { User } from '../users'
import { create } from '../../helpers/dynamo-helpers/create'
import { v4 } from 'uuid'

export const createUser = async (event: APIGatewayProxyEvent) => {
  try {
    const userToCreate: Partial<User> = JSON.parse(event.body ?? '{}')
    // ensure user has at minimum a name and an organization id
    if (!userToCreate.name || !userToCreate.organization_id || !userToCreate.email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Name, organization ID, and email are required' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    const userId = v4()
    userToCreate.id = userId
    const user = await create({
      tableName: process.env.USERS_TABLE!,
      key: {
        id: userId
      },
      record: userToCreate,
      returnCreated: true
    })
    return {
      statusCode: 201,
      body: JSON.stringify(user),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: (error as Error).message }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
}