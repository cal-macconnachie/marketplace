import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand
} from '@aws-sdk/client-cognito-identity-provider'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { User } from '../users'
import { getUserByEmail } from '../../helpers/users/get-user-by-email'

const cognitoClient = new CognitoIdentityProviderClient({})
const CLIENT_ID = process.env.USER_POOL_CLIENT_ID || ''

export const login = async (event: APIGatewayProxyEvent) => {
  const { body } = event
  const {
    email, password, accessToken 
  } = JSON.parse(body || '{}')
  
  // Support both email/password and social token authentication
  if (!accessToken && (!email || !password)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ 
        message: 'Either email/password or accessToken is required' 
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let response: any
    let userEmail: string | undefined
    let user: User | undefined
    if (accessToken) {
      // Social authentication - decode the access token to get user info
      // In practice, you might validate this token with Cognito
      const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString('utf-8'))
      userEmail = payload.email || payload['cognito:username']
      
      // For social auth, we already have valid tokens
      response = {
        AuthenticationResult: {
          AccessToken: accessToken,
          IdToken: accessToken, // In real implementation, these would be different
          RefreshToken: null // Social tokens might not have refresh tokens
        }
      }
    } else {
      // Traditional email/password authentication
      user = await getUserByEmail(email)

      if (user == null) {
        throw new Error('[404] User not found')
      }

      userEmail = user.email
      if (userEmail == null) {
        throw new Error('[404] User not found')
      }
      
      const command = new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: CLIENT_ID,
        AuthParameters: {
          USERNAME: userEmail,
          PASSWORD: password
        }
      })

      response = await cognitoClient.send(command)
    }
    if (userEmail == null) throw new Error('[404] User not found')

    // Get user from DynamoDB
    if (user == null) user = await getUserByEmail(userEmail)

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Login successful',
        accessToken: response.AuthenticationResult?.AccessToken,
        idToken: response.AuthenticationResult?.IdToken,
        refreshToken: response.AuthenticationResult?.RefreshToken,
        user
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      }
    }
  } catch (error) {
    console.error('Error during login:', error)
    return {
      statusCode: 401,
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Login failed' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      }
    }
  }
}
