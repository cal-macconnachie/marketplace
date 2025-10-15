import {
  domain,
  notificationsTableName, USER_NOTIFICATION_TYPES, usersTableName
} from '@marketplace/constants'
import {
  CreateNotificationRequest, Notification,
  User
} from '@marketplace/types'
import { v4 } from 'uuid'
import { create } from '../../dynamo-helpers/create'
import { get } from '../../dynamo-helpers/get'
import { sendEmail } from '../../emails/send-email'
import { sendSMS } from '../../sms/send-sms'

/**
 * Create a notification in DynamoDB with auto-populated composite fields
 * for efficient querying by read status and type
 */
export const createNotification = async ({
  user_id,
  type = 'system',
  title,
  message,
  metadata,
  basic = true
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

  if (basic) {
    const user = await get<User>({
      tableName: usersTableName,
      key: { id: user_id }
    })
    if (user && (user.notifications?.email || user.notifications?.sms) && user.notification_opt_out?.[type] !== true) {
      // Send notification via email or SMS
      if (user.notifications?.email && user.notification_opt_out?.email !== true) {
        const htmlBody = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>${title}</title>
    <style>
      html, body { margin: 0 !important; padding: 0 !important; height: 100% !important; width: 100% !important; }
      * { -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; }
      .wrapper { width: 100%; background: #f6f7fb; }
      .container { width: 100%; max-width: 600px; margin: 0 auto; background: #ffffff; }
      .px-24 { padding-left: 24px; padding-right: 24px; }
      .py-16 { padding-top: 16px; padding-bottom: 16px; }
      .hr { height: 1px; line-height: 1px; background: #e5e7eb; border: none; margin: 0; }
      .brand { font: 600 18px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #111827; text-align: center; }
      .h1 { font: 700 20px/1.3 system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #111827; margin: 0; }
      .body { font: 400 14px/20px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #111827; }
      .muted { color: #6b7280; font-size: 12px; line-height: 18px; }
      .text-center { text-align: center; }
      @media (prefers-color-scheme: dark) {
        .wrapper { background: #0b0f15 !important; }
        .container { background: #111827 !important; }
        .brand, .h1, .body { color: #f9fafb !important; }
        .muted { color: #9ca3af !important; }
        .hr { background: #374151 !important; }
      }
      @media screen and (max-width: 600px) {
        .px-24 { padding-left: 16px !important; padding-right: 16px !important; }
      }
    </style>
  </head>
  <body class="body" style="background:#f6f7fb;">
    <table role="presentation" class="wrapper" cellpadding="0" cellspacing="0" width="100%" style="width:100%;background:#f6f7fb;">
      <tr>
        <td align="center">
          <table role="presentation" class="container" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;background:#ffffff;">
            <!-- Header -->
            <tr>
              <td class="px-24 py-16">
                <div class="brand">Marketplace</div>
              </td>
            </tr>
            <tr><td><hr class="hr" /></td></tr>

            <!-- Title -->
            <tr>
              <td class="px-24 py-16">
                <h1 class="h1">${title}</h1>
              </td>
            </tr>

            <!-- Message -->
            <tr>
              <td class="px-24 py-16">
                <div class="body">${message}</div>
              </td>
            </tr>

            <tr><td><hr class="hr" /></td></tr>

            <!-- Footer -->
            <tr>
              <td class="px-24 py-16 text-center muted">
                This is an automated notification from Marketplace, please log in at <a href="https://${domain}" style="color: #3b82f6; text-decoration: none;">${domain}</a> to take action.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

        await sendEmail({
          to: user.email!,
          from: `${USER_NOTIFICATION_TYPES[type].label} <no-reply@${domain}>`,
          subject: title,
          body: htmlBody
        })
      }
      if (user.notifications?.sms && user.notification_opt_out?.sms !== true) {
        await sendSMS({
          phoneNumber: user.phone_number!,
          message: `${notification.message}\n\nLog in at https://${domain} to take action.`,
          senderId: 'Marketplace'
        })
      }
    }
  }

  return notification
}
