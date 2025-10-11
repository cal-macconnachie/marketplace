import { usersTableName } from '@marketplace/constants'
import { User } from '@marketplace/types'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { update } from '../../helpers/dynamo-helpers/update'

export const updateUser = async (event: APIGatewayProxyEvent) => {
  const { body } = event
  const userData: Partial<User> = JSON.parse(body || '{}')

  try {
    const id = userData.id
    const allowedFields = [
      'given_name',
      'family_name',
      'name',
      'phone_number',
      'address',
      'ip_address',
      'notifications'
    ]
    const keys = Object.keys(userData) as (keyof User)[]
    for (const field of keys) {
      if (!allowedFields.includes(field)) {
        delete userData[field]
      }
    }
    const user = await update<User>({
      tableName: usersTableName!,
      key: {
        id
      },
      updates: userData,
      returnUpdated: true
    })
    return {
      statusCode: 200,
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
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'User update failed' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
}
