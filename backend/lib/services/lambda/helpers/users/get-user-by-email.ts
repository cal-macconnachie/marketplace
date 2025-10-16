import { usersTableName } from '@marketplace/constants'
import { User } from '@marketplace/types'
import { query } from "../dynamo-helpers/query"

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const { items } = await query<User>({
    tableName: usersTableName,
    indexName: 'email-index',
    keyConditionExpression: '#email = :email',
    expressionAttributeNames: {
      '#email': 'email'
    },
    expressionAttributeValues: {
      ':email': email
    }
  })

  return items[0]
}