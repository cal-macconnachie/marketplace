import { notificationsTableName } from '@marketplace/constants'
import { Notification } from '@marketplace/types'
import { get } from '../../dynamo-helpers/get'
import { update } from '../../dynamo-helpers/update'

/**
 * Mark a notification as read or unread
 */
export const markNotificationRead = async ({
  userId,
  notificationId,
}: {
  userId: string
  notificationId: string
}): Promise<void> => {
  const read = true
  const notification = await get<Notification>({
    tableName: notificationsTableName,
    key: {
      user_id: userId,
      id: notificationId
    }
  })
  if (!notification) {
    throw new Error(`Notification not found: ${notificationId} for user ${userId}`)
  }
  const {
    created_at: createdAt, type 
  } = notification
  if (!createdAt || !type) {
    throw new Error(`Notification missing created_at or type: ${notificationId} for user ${userId}`)
  }
  const compositeFields = getUpdatedCompositeFields(read, createdAt, type)

  await update<Notification>({
    tableName: notificationsTableName,
    key: {
      user_id: userId,
      id: notificationId
    },
    updates: {
      read,
      ...compositeFields
    }
  })
}

/**
 * Helper to update composite fields when marking a notification as read/unread
 * Call this when updating the read status of a notification
 */
export const getUpdatedCompositeFields = (
  read: boolean,
  created_at: number,
  type: Notification['type']
): Pick<Notification, 'read_created_at' | 'type_created_at'> => {
  return {
    read_created_at: `${read}#${created_at}`,
    type_created_at: `${type}#${created_at}`
  }
}
