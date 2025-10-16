import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand
} from '@aws-sdk/client-cognito-identity-provider'
import { User } from '@marketplace/types'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { rateLimitedHandler } from '../../helpers/rate-limited-handler'
import { createUpdateUser } from '../../helpers/users/create-update-user'
import { getUserByEmail } from '../../helpers/users/get-user-by-email'

const cognitoClient = new CognitoIdentityProviderClient({})
const CLIENT_ID = process.env.USER_POOL_CLIENT_ID || ''

export const login = rateLimitedHandler(async (event: APIGatewayProxyEvent) => {
  const { body } = event
  const {
    email, password, accessToken, idToken, refreshToken
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
      }
    }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let response: any
    let userEmail: string | undefined
    let user: User | undefined
    if (accessToken && idToken) {
      // Social authentication - decode the access token to get user info
      // In practice, you might validate this token with Cognito
      const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString('utf-8'))
      userEmail = payload.email || payload['cognito:username']
      if (userEmail == null) {
        throw new Error('[400] Invalid token: email not found')
      }
      if (user == null) user = await getUserByEmail(userEmail)
      // if user is still null this is a first time login for this social user so we should create them
      if (user == null) {
        user = await createUpdateUser({
          email: userEmail,
          cognito_id: payload.sub,
          is_organization_admin: true,
          family_name: payload.family_name,
          given_name: payload.given_name
        })
      }
      
      // For social auth, we already have valid tokens
      response = {
        AuthenticationResult: {
          AccessToken: accessToken,
          IdToken: idToken,
          RefreshToken: refreshToken // Social tokens might not have refresh tokens
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
}, {
  windowMs: 60 * 1000, // 1 minute window
  maxRequests: 5 // 5 login attempts per minute to prevent brute force
})
