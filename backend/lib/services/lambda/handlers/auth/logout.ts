import {
  CognitoIdentityProviderClient,
  GlobalSignOutCommand,
  RevokeTokenCommand
} from '@aws-sdk/client-cognito-identity-provider'
import { domain } from '@marketplace/constants'
import { APIGatewayProxyEvent } from 'aws-lambda'
const cognitoClient = new CognitoIdentityProviderClient({})

export const logout = async (event: APIGatewayProxyEvent) => {
  const { body } = event
  const {
    accessToken, refreshToken 
  } = JSON.parse(body || '{}')

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
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true,
            'Content-Type': 'application/json'
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
      const envName = process.env.NODE_ENV || 'dev'
      const cognitoDomain = envName === 'dev'
        ? `auth.dev.${domain}`
        : `auth.${domain}`
      const logoutUrl = envName === 'dev' ? `https://dev.${domain}` : `https://${domain}`
      const cognitoLogoutUrl = `https://${cognitoDomain}/logout?client_id=${process.env.USER_POOL_CLIENT_ID}&logout_uri=${encodeURIComponent(logoutUrl)}`

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Logout successful',
          redirectUrl: cognitoLogoutUrl,
          requiresRedirect: true
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    throw new Error('No valid token provided for logout')
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Logout failed' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
}
