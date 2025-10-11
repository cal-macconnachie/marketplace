import { notificationsTableName } from '@marketplace/constants'
import { Notification } from '@marketplace/types'
import { query } from '../../dynamo-helpers/query'

/**
 * Query notifications for a user with optional filtering by read status and type
 */
export const queryUserNotifications = async ({
  userId,
  unreadOnly = false,
  type,
  limit,
  exclusiveStartKey
}: {
  userId: string
  unreadOnly?: boolean
  type?: string
  limit?: number
  exclusiveStartKey?: Record<string, unknown>
}): Promise<{ items: Notification[]; lastEvaluatedKey?: Record<string, unknown> }> => {
  // If filtering by type, use the type index
  if (type) {
    const result = await query<Notification>({
      tableName: notificationsTableName,
      indexName: 'user-type-created-index',
      keyConditionExpression: 'user_id = :userId AND begins_with(type_created_at, :prefix)',
      expressionAttributeValues: unreadOnly ? {
        ':userId': userId,
        ':prefix': `${type}#`,
        ':read': false
      } : {
        ':userId': userId,
        ':prefix': `${type}#`
      },
      // If also filtering by unread, add a filter expression
      filterExpression: unreadOnly ? '#read = :read' : undefined,
      expressionAttributeNames: unreadOnly ? { '#read': 'read' } : undefined,
      sortOrder: 'DESC', // Newest first
      limit,
      exclusiveStartKey
    })
    return result
  }

  // If filtering by unread only, use the read-status index
  if (unreadOnly) {
    const result = await query<Notification>({
      tableName: notificationsTableName,
      indexName: 'user-read-created-index',
      keyConditionExpression: 'user_id = :userId AND begins_with(read_created_at, :prefix)',
      expressionAttributeValues: {
        ':userId': userId,
        ':prefix': 'false#'
      },
      sortOrder: 'DESC', // Newest first
      limit,
      exclusiveStartKey
    })
    return result
  }

  // Query all notifications for the user using the created-at index for proper timestamp sorting
  const result = await query<Notification>({
    tableName: notificationsTableName,
    indexName: 'user-created-index',
    keyConditionExpression: 'user_id = :userId',
    expressionAttributeValues: {
      ':userId': userId
    },
    sortOrder: 'DESC', // Newest first
    limit,
    exclusiveStartKey
  })
  return result
}
