import { notificationsTableName } from '@marketplace/constants'
import { queryAll } from '../../dynamo-helpers/query'

/**
 * Get count of unread notifications for a user
 */
export const getUnreadNotificationCount = async (
  params: { userId: string }
): Promise<number> => {
  // Use the read-status index to count only unread notifications
  const items = await queryAll<{ id: string }>({
    tableName: notificationsTableName,
    indexName: 'user-read-created-index',
    keyConditionExpression: 'user_id = :userId AND begins_with(read_created_at, :prefix)',
    expressionAttributeValues: {
      ':userId': params.userId,
      ':prefix': 'false#'
    },
    sortOrder: 'DESC'
  })
  return items.length
}
