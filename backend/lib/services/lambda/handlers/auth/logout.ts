import {
  CognitoIdentityProviderClient,
  GlobalSignOutCommand,
  RevokeTokenCommand
} from '@aws-sdk/client-cognito-identity-provider'
import { APIGatewayProxyEvent } from 'aws-lambda'
import {
  createClearAuthCookieHeaders,
  parseCookies,
  validateAndGetCorsHeaders
} from '../../helpers/cookie-utils'

const cognitoClient = new CognitoIdentityProviderClient({})

export const logout = async (event: APIGatewayProxyEvent) => {
  const corsHeaders = validateAndGetCorsHeaders(event.headers.origin)
  const clearCookieHeaders = createClearAuthCookieHeaders()

  // Parse tokens from httpOnly cookies
  const cookies = parseCookies(event.headers.cookie || event.headers.Cookie)
  const accessToken = cookies.accessToken
  const refreshToken = cookies.refreshToken

  try {
    // Try GlobalSignOut first (works for native Cognito users)
    if (accessToken) {
      try {
        const command = new GlobalSignOutCommand({
          AccessToken: accessToken
        })
        await cognitoClient.send(command)

        // For native Cognito users, no hosted UI redirect needed
        // Just return success - frontend will handle local redirect
        return {
          statusCode: 200,
          body: JSON.stringify({
            message: 'Logout successful',
            requiresRedirect: false
          }),
          headers: corsHeaders,
          multiValueHeaders: {
            'Set-Cookie': clearCookieHeaders
          }
        }
      } catch (error) {
        // If GlobalSignOut fails (OAuth users), fall through to RevokeToken
        console.log('GlobalSignOut failed, trying RevokeToken:', error instanceof Error ? error.message : error)
      }
    }

    // For OAuth users or if GlobalSignOut fails, use RevokeToken with refresh token
    if (refreshToken) {
      const revokeCommand = new RevokeTokenCommand({
        Token: refreshToken,
        ClientId: process.env.USER_POOL_CLIENT_ID!
      })
      await cognitoClient.send(revokeCommand)

      // Tokens revoked successfully - no Cognito redirect needed
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Logout successful',
          requiresRedirect: false
        }),
        headers: corsHeaders,
        multiValueHeaders: {
          'Set-Cookie': clearCookieHeaders
        }
      }
    }

    throw new Error('No valid token provided for logout')
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Logout failed' }),
      headers: corsHeaders,
      multiValueHeaders: {
        'Set-Cookie': clearCookieHeaders
      }
    }
  }
}
