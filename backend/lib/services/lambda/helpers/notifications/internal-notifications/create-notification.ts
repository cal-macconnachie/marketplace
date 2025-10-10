import { notificationsTableName } from '@marketplace/constants'
import {
  CreateNotificationRequest, Notification
} from '@marketplace/types'
import { v4 } from 'uuid'
import { create } from '../../dynamo-helpers/create'

/**
 * Create a notification in DynamoDB with auto-populated composite fields
 * for efficient querying by read status and type
 */
export const createNotification = async ({
  user_id,
  type = 'system',
  title,
  message,
  metadata
}: CreateNotificationRequest
): Promise<Notification> => {
  const now = Date.now()
  const id = v4()

  const notification: Notification = {
    id,
    user_id,
    title,
    message,
    type,
    read: false,
    created_at: now,
    // Composite fields for GSI queries
    read_created_at: `false#${now}`,
    type_created_at: `${type}#${now}`,
    metadata
  }

  await create<Notification>({
    tableName: notificationsTableName,
    key: {
      user_id: notification.user_id,
      id: notification.id
    },
    record: notification
  })

  return notification
}
