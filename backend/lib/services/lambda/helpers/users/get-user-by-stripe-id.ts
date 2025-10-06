import { User } from "../../handlers/users"
import { query } from "../dynamo-helpers/query"

export async function getUserByStripeId(stripeId: string): Promise<User | undefined> {
  const { items } = await query<User>({
    tableName: process.env.USERS_TABLE! || 'users-dev',
    indexName: 'stripe_id-index',
    keyConditionExpression: '#stripeId = :stripeId',
    expressionAttributeNames: {
      '#stripeId': 'stripe_id'
    },
    expressionAttributeValues: {
      ':stripeId': stripeId
    }
  })

  return items[0]
}