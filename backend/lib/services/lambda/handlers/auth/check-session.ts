import { APIGatewayProxyEvent } from 'aws-lambda'
import { validateAndGetCorsHeaders } from '../../helpers/cookie-utils'
import { getUserFromEvent } from '../../helpers/get-user-from-event'

export const checkSession = async (event: APIGatewayProxyEvent) => {
  const corsHeaders = validateAndGetCorsHeaders(event.headers.origin)
  const user = await getUserFromEvent(event)

  if (!user) {
    return {
      statusCode: 401,
      body: JSON.stringify({
        message: 'Unauthorized: Invalid session'
      }),
      headers: corsHeaders
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      user
    }),
    headers: corsHeaders
  }
}