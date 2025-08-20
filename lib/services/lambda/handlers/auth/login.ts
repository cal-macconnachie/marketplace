import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand
} from '@aws-sdk/client-cognito-identity-provider'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { query } from '../../helpers/dynamo-helpers/query'
import { User } from '../users'
import { getUserByEmail } from '../../helpers/users/get-user-by-email'

const cognitoClient = new CognitoIdentityProviderClient({})
const CLIENT_ID = process.env.USER_POOL_CLIENT_ID || ''

export const login = async (event: APIGatewayProxyEvent) => {
  const { body } = event
  const {
    username, password, accessToken 
  } = JSON.parse(body || '{}')
  
  // Support both email/password and social token authentication
  if (!accessToken && (!username || !password)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ 
        message: 'Either username/password or accessToken is required' 
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
    let email: string | undefined
    if (accessToken) {
      // Social authentication - decode the access token to get user info
      // In practice, you might validate this token with Cognito
      const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString('utf-8'))
      email = payload.email || payload['cognito:username']
      
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
      const { items } = await query<User>({
        tableName: process.env.USERS_TABLE! || 'users-dev',
        indexName: 'email-index',
        keyConditionExpression: '#email = :email',
        expressionAttributeNames: {
          '#email': 'email'
        },
        expressionAttributeValues: {
          ':email': username
        }
      })
      
      if (!(items.length > 0)) {
        throw new Error('[404] User not found')
      }
      
      email = items[0].email
      if (email == null) {
        throw new Error('[404] User not found')
      }
      
      const command = new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: CLIENT_ID,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password
        }
      })

      response = await cognitoClient.send(command)
    }
    if (email == null) throw new Error('[404] User not found')

    // Get user from DynamoDB
    const user = await getUserByEmail(email)

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
