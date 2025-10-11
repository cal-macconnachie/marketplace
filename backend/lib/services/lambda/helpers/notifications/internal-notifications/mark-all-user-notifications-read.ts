import { notificationsTableName } from '@marketplace/constants'
import { Notification } from '@marketplace/types'
import { queryAll } from '../../dynamo-helpers/query'
import { update } from '../../dynamo-helpers/update'
import { getUpdatedCompositeFields } from './mark-notification-read'

export const markAllUserNotificationsRead = async ({
  userId
}: {
  userId: string
}): Promise<void> => {
  // Fetch all unread notifications for the user
  const notifications = await queryAll<Notification>({
    tableName: notificationsTableName,
    indexName: 'user-read-created-index',
    keyConditionExpression: 'user_id = :userId AND read_created_at BEGINS WITH :read',
    expressionAttributeValues: {
      ':userId': userId,
      ':read': 'false'
    },
  })
  const promises: Promise<void>[] = []
  const read = true
  for (const notification of notifications) {
    const updatedCompositeFields = getUpdatedCompositeFields(read, notification.created_at!, notification.type!)
    promises.push(update<Notification>({
      tableName: notificationsTableName,
      key: {
        user_id: userId,
        id: notification.id
      },
      updates: {
        read,
        ...updatedCompositeFields
      },
      returnUpdated: false
    }))
  }
  await Promise.allSettled(promises)
}