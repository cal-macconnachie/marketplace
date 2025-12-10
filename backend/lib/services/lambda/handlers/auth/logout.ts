import {
  CognitoIdentityProviderClient,
  GlobalSignOutCommand,
  RevokeTokenCommand
} from '@aws-sdk/client-cognito-identity-provider'
import { domain } from '@marketplace/constants'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { parseCookies, createClearAuthCookieHeaders, validateAndGetCorsHeaders } from '../../helpers/cookie-utils'

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

        return {
          statusCode: 200,
          body: JSON.stringify({ message: 'Logout successful' }),
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

      // Build Cognito logout URL for OAuth users
      const cognitoDomain = `auth.${domain}`
      const logoutUrl = `https://${domain}`
      const cognitoLogoutUrl = `https://${cognitoDomain}/logout?client_id=${process.env.USER_POOL_CLIENT_ID}&logout_uri=${encodeURIComponent(logoutUrl)}`

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Logout successful',
          redirectUrl: cognitoLogoutUrl,
          requiresRedirect: true
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
