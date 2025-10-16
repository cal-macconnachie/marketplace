import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand
} from '@aws-sdk/client-cognito-identity-provider'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { rateLimitedHandler } from '../../helpers/rate-limited-handler'

const cognitoClient = new CognitoIdentityProviderClient({})

export const refresh = rateLimitedHandler(async (event: APIGatewayProxyEvent) => {
  const CLIENT_ID = process.env.USER_POOL_CLIENT_ID
  if (!CLIENT_ID) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'CLIENT_ID environment variable is not set' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      }
    }
  }

  const { refreshToken } = JSON.parse(event.body || '{}')
  console.log('Refresh token request for token:', refreshToken?.substring(0, 20) + '...')

  if (!refreshToken) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Refresh token is required' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      }
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

    return {
      statusCode: 200,
      body: JSON.stringify({
        accessToken: response.AuthenticationResult?.AccessToken,
        idToken: response.AuthenticationResult?.IdToken,
        refreshToken: response.AuthenticationResult?.RefreshToken
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
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
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      }
    }
  }
}, {
  windowMs: 60 * 1000, // 1 minute window
  maxRequests: 10 // 10 refresh requests per minute (more lenient for auto-refresh)
})
