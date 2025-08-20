import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand
} from '@aws-sdk/client-cognito-identity-provider'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { createUpdateUser } from '../../helpers/users/create-update-user'
import { v4 } from 'uuid'

const cognitoClient = new CognitoIdentityProviderClient({})
const USER_POOL_ID = process.env.USER_POOL_ID || ''

export const register = async (event: APIGatewayProxyEvent) => {
  const {
    email, password, phone_number 
  } = JSON.parse(event.body ?? '{}')
  if (!email || !password) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Email and password are required' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      }
    }
  }
  try {
    const command = new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      UserAttributes: [
        {
          Name: 'email', Value: email 
        }
      ],
      MessageAction: 'SUPPRESS' // Suppress the welcome email
    })
    const createUserResponse = await cognitoClient.send(command)

    const adminSetUserPasswordCommand = new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      Password: password,
      Permanent: true
    })
    await cognitoClient.send(adminSetUserPasswordCommand)

    // Extract Cognito user sub (id)
    const cognitoId = createUserResponse?.User?.Attributes?.find(
      (attr) => attr.Name === 'sub'
    )?.Value

    if (!cognitoId) {
      throw new Error('Failed to retrieve Cognito user sub')
    }

    // Insert user into users DynamoDB table using helper
    await createUpdateUser({
      email,
      phone_number,
      cognito_id: cognitoId,
      organization_id: v4(),
      is_organization_admin: true
    })

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'User created successfully' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        cognito_id: cognitoId
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
        'Content-Type': 'application/json'
      }
    }
  }
}
