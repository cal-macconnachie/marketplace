import {
  CognitoIdentityProviderClient,
  GlobalSignOutCommand
} from '@aws-sdk/client-cognito-identity-provider'
import { APIGatewayProxyEvent } from 'aws-lambda'
const cognitoClient = new CognitoIdentityProviderClient({})

export const logout = async (event: APIGatewayProxyEvent) => {
  const { body } = event
  const { accessToken } = JSON.parse(body || '{}')

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
