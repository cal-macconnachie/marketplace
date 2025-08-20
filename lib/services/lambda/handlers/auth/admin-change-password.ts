import {
  AdminSetUserPasswordCommand, CognitoIdentityProviderClient 
} from "@aws-sdk/client-cognito-identity-provider"
import { APIGatewayProxyEvent } from "aws-lambda"
const cognitoClient = new CognitoIdentityProviderClient({})

export async function adminChangePassword(event: APIGatewayProxyEvent) {
  const { body } = event
  const {
    email, newPassword 
  } = JSON.parse(body || '{}')
  if (!email || !newPassword) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing required fields' })
    }
  }
  await cognitoClient.send(new AdminSetUserPasswordCommand({
    UserPoolId: process.env.USER_POOL_ID!,
    Username: email,
    Password: newPassword,
    Permanent: true
  }))
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Password changed successfully' })
  }
}