import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand
} from '@aws-sdk/client-cognito-identity-provider'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { rateLimitedHandler } from '../../helpers/rate-limited-handler'
import { parseCookies, createAuthCookieHeaders, validateAndGetCorsHeaders } from '../../helpers/cookie-utils'

const cognitoClient = new CognitoIdentityProviderClient({})

export const refresh = rateLimitedHandler(async (event: APIGatewayProxyEvent) => {
  const CLIENT_ID = process.env.USER_POOL_CLIENT_ID
  const corsHeaders = validateAndGetCorsHeaders(event.headers.origin)

  if (!CLIENT_ID) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'CLIENT_ID environment variable is not set' }),
      headers: corsHeaders
    }
  }

  // Parse refresh token from httpOnly cookie
  const cookies = parseCookies(event.headers.cookie || event.headers.Cookie)
  const refreshToken = cookies.refreshToken

  console.log('Refresh token request for token:', refreshToken?.substring(0, 20) + '...')

  if (!refreshToken) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Refresh token is required' }),
      headers: corsHeaders
    }
  }

  try {
    const command = new InitiateAuthCommand({
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken
      }
    })

    const response = await cognitoClient.send(command)

    // Set new tokens as httpOnly cookies
    const cookieHeaders = createAuthCookieHeaders(
      response.AuthenticationResult?.AccessToken || '',
      response.AuthenticationResult?.IdToken,
      response.AuthenticationResult?.RefreshToken
    )

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Token refreshed successfully'
      }),
      headers: corsHeaders,
      multiValueHeaders: {
        'Set-Cookie': cookieHeaders
      }
    }
  } catch (error) {
    console.error('Error refreshing token:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Failed to refresh token',
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      headers: corsHeaders
    }
  }
}, {
  windowMs: 60 * 1000, // 1 minute window
  maxRequests: 10 // 10 refresh requests per minute (more lenient for auto-refresh)
})
