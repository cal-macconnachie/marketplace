import { notificationsTableName } from '@marketplace/constants'
import { Notification } from '@marketplace/types'
import { query } from '../../dynamo-helpers/query'

/**
 * Query notifications by type for a user
 */
export const queryNotificationsByType = async ({
  userId,
  type,
  limit
}: {
  userId: string
  type: 'receipt' | 'sale' | 'system'
  limit?: number
}): Promise<Notification[]> => {
  const result = await query<Notification>({
    tableName: notificationsTableName,
    indexName: 'user-type-created-index',
    keyConditionExpression: 'user_id = :userId AND begins_with(type_created_at, :prefix)',
    expressionAttributeValues: {
      ':userId': userId,
      ':prefix': `${type}#`
    },
    sortOrder: 'DESC', // Newest first
    limit
  })
  return result.items
}
