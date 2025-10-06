import { usersTableName } from '@marketplace/constants'
import { User } from '@marketplace/types'
import { query } from "../dynamo-helpers/query"

export async function getUserByStripeId(stripeId: string): Promise<User | undefined> {
  const { items } = await query<User>({
    tableName: usersTableName! || 'users-dev',
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