import {
  CognitoIdentityProviderClient,
  GlobalSignOutCommand
} from '@aws-sdk/client-cognito-identity-provider'
import { APIGatewayProxyEvent } from 'aws-lambda'
const cognitoClient = new CognitoIdentityProviderClient({})

export const logout = async (event: APIGatewayProxyEvent) => {
  const authHeader = event.headers?.Authorization || event.headers?.authorization
  let accessToken = ''
  if (authHeader && authHeader.startsWith('Bearer ')) {
    accessToken = authHeader.slice(7)
  }
  if (!accessToken) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing or invalid Authorization header' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }

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
