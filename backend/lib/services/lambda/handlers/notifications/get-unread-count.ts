import { APIGatewayProxyEvent } from 'aws-lambda'
import { getUnreadNotificationCount } from '../../helpers/notifications/internal-notifications/get-unread-notification-count'
import { getUserByEmail } from '../../helpers/users/get-user-by-email'

/**
 * GET /notifications/unread-count
 * Returns unread notification count for the authenticated user with ETag support.
 */
export const getUnreadNotificationCountHandler = async (event: APIGatewayProxyEvent) => {
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

    // Compute unread count
    const count = await getUnreadNotificationCount({ userId: user.id })

    // Build a weak ETag based on count; adequate for light polling
    const etag = `W/"${count}"`

    // Handle If-None-Match for conditional GET
    const ifNoneMatch = event.headers?.['if-none-match'] || event.headers?.['If-None-Match']
    if (ifNoneMatch && ifNoneMatch === etag) {
      return {
        statusCode: 304,
        body: '',
        headers: {
          ETag: etag,
          'Cache-Control': 'no-cache',
          Vary: 'Authorization',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true
        }
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ count }),
      headers: {
        ETag: etag,
        'Cache-Control': 'no-cache',
        Vary: 'Authorization',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } catch (err) {
    console.error('Error occurred while fetching unread notification count:', err)
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

