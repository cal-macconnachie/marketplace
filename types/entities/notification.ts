/**
 * Notification entity types
 */

/**
 * Notification preferences for a user
 */
export interface NotificationPreferences {
  user_id: string
  email_enabled: boolean
  sms_enabled: boolean
  receipts: boolean
  sales: boolean
  updated_at: number
}

/**
 * Individual notification sent to a user
 */
export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  read: boolean
  created_at: number
  type: 'receipt' | 'sale' | 'system' | 'refund_processed' | 'dispute_created' | 'refund_failed'
  // Composite attributes for GSI queries (auto-populated)
  read_created_at: string // Format: "true#1234567890" or "false#1234567890"
  type_created_at: string // Format: "receipt#1234567890" or "sale#1234567890"
  metadata?: {
    [key: string]: any
  }
}

/**
 * Request to create a new notification
 */
export interface CreateNotificationRequest {
  user_id: string
  title: string
  message: string
  type?: Notification['type']
  metadata?: Notification['metadata']
}

/**
 * Request to update notification preferences
 */
export interface UpdateNotificationPreferencesRequest {
  user_id: string
  preferences: Partial<Omit<NotificationPreferences, 'user_id' | 'updated_at'>>
}
