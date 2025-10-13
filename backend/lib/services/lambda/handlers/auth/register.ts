import {
  CognitoIdentityProviderClient,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { oneTimeCodesTableName } from '@marketplace/constants'
import { OneTimePassword } from '@marketplace/types'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { get } from '../../helpers/dynamo-helpers/get'
import { rateLimitedHandler } from '../../helpers/rate-limited-handler'
import { createUpdateUser } from '../../helpers/users/create-update-user'
import { getUserByEmail } from '../../helpers/users/get-user-by-email'

const cognitoClient = new CognitoIdentityProviderClient({})

export const register = rateLimitedHandler(async (event: APIGatewayProxyEvent) => {
  const {
    email, password, phone_number, family_name, given_name, code
  } = JSON.parse(event.body ?? '{}')

  if (!email || !password || !code) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Email, password, and code are required' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      }
    }
  }

  // Verify OTP

  const otp = await get<OneTimePassword>({
    tableName: oneTimeCodesTableName!,
    key: {
      email,
      type: 'registration'
    }
  })

  if (!otp || otp.one_time_password !== code) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Invalid or expired OTP' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      }
    }
  }

  // Check if OTP is expired (15 minutes)
  if (new Date(otp.created_at) < new Date(Date.now() - 15 * 60 * 1000)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'OTP has expired' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      }
    }
  }

  try {
    const existingUser = await getUserByEmail(email)
    if (existingUser && existingUser.cognito_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'User with this email already exists, please try logging in or resetting your password.' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true
        }
      }
    }
    const command = new SignUpCommand({
      ClientId: process.env.USER_POOL_CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: [
        {
          Name: 'email', Value: email
        }
      ],
    })
    const createUserResponse = await cognitoClient.send(command)

    // Extract Cognito user sub (id)
    const cognitoId = createUserResponse?.UserSub

    if (!cognitoId) {
      throw new Error('Failed to retrieve Cognito user sub')
    }

    // Insert user into users DynamoDB table using helper
    await createUpdateUser({
      email,
      phone_number,
      cognito_id: cognitoId,
      is_organization_admin: true,
      ...(family_name != null && given_name != null ? {
        family_name, given_name
      } : family_name != null ? { family_name } : given_name != null ? { given_name } : {})
    })

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'User created successfully' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      }
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'User creation failed'
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      }
    }
  }
})
