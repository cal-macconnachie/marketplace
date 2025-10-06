import { User } from "../../handlers/users"
import { query } from "../dynamo-helpers/query"

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const { items } = await query<User>({
    tableName: process.env.USERS_TABLE! || 'users-dev',
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