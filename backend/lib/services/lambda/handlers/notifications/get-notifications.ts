import { APIGatewayProxyEvent } from 'aws-lambda'
import { getUnreadNotificationCount } from '../../helpers/notifications/internal-notifications/get-unread-notification-count'
import { queryUserNotifications } from '../../helpers/notifications/internal-notifications/query-user-notifications'
import { getUserByEmail } from '../../helpers/users/get-user-by-email'

/**
 * Get notifications for the authenticated user
 * Request body parameters:
 * - unreadOnly: boolean (optional) - Only return unread notifications
 * - type: string (optional) - Filter by notification type (e.g., 'receipt', 'sale', 'system')
 * - limit: number (optional) - Limit the number of notifications returned
 * - exclusiveStartKey: object (optional) - Pagination key from previous response
 * - countOnly: boolean (optional) - Return only the count of unread notifications
 */
export const getNotifications = async (event: APIGatewayProxyEvent) => {
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
      unreadOnly,
      type,
      limit,
      exclusiveStartKey,
      countOnly
    } = JSON.parse(event.body ?? '{}')

    // If countOnly is requested, return unread count
    if (countOnly === true) {
      const count = await getUnreadNotificationCount({ userId: user.id })
      return {
        statusCode: 200,
        body: JSON.stringify({ count }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    // Validate limit if provided
    const parsedLimit = limit ? parseInt(limit, 10) : undefined
    if (parsedLimit !== undefined && (isNaN(parsedLimit) || parsedLimit < 1)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid limit. Must be a positive integer.' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    const result = await queryUserNotifications({
      userId: user.id,
      unreadOnly: unreadOnly === true,
      type,
      limit: parsedLimit,
      exclusiveStartKey
    })

    return {
      statusCode: 200,
      body: JSON.stringify({
        notifications: result.items,
        lastEvaluatedKey: result.lastEvaluatedKey
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } catch (err) {
    console.error('Error occurred while fetching notifications:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
}
