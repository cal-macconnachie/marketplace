import { APIGatewayProxyEvent } from 'aws-lambda'
import { markAllUserNotificationsRead } from '../../helpers/notifications/internal-notifications/mark-all-user-notifications-read'
import { markNotificationRead } from '../../helpers/notifications/internal-notifications/mark-notification-read'
import { getUserByEmail } from '../../helpers/users/get-user-by-email'

/**
 * Update notification read status for the authenticated user
 * Request body parameters:
 * - notificationId: string (optional) - ID of specific notification to mark as read
 * - markAllRead: boolean (optional) - If true, marks all notifications as read
 *
 * Either notificationId or markAllRead must be provided
 */
export const updateNotification = async (event: APIGatewayProxyEvent) => {
  try {
    const userEmail = event.requestContext.authorizer?.claims?.email
    if (!userEmail) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    const user = await getUserByEmail(userEmail)
    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'User not found' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    const {
      notificationId, markAllRead 
    } = JSON.parse(event.body ?? '{}')

    // Validate that at least one action is specified
    if (!notificationId && !markAllRead) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Either notificationId or markAllRead must be provided'
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    // Mark all notifications as read
    if (markAllRead === true) {
      await markAllUserNotificationsRead({ userId: user.id })
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'All notifications marked as read' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    // Mark specific notification as read
    if (notificationId) {
      await markNotificationRead({
        userId: user.id,
        notificationId
      })
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Notification marked as read' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid request' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } catch (err) {
    console.error('Error occurred while updating notification:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: err instanceof Error ? err.message : 'Internal Server Error'
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
}
