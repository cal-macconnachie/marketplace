import { APIGatewayProxyEvent } from "aws-lambda"
import {
  ChangePasswordCommand, CognitoIdentityProviderClient 
} from "@aws-sdk/client-cognito-identity-provider"
const cognitoClient = new CognitoIdentityProviderClient({})
export async function changePassword(event: APIGatewayProxyEvent) {
  const { body } = event
  const {
    accessToken, oldPassword, newPassword
  } = JSON.parse(body || "{}")
  if (!accessToken || !oldPassword || !newPassword) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing required fields' })
    }
  }

  const command = new ChangePasswordCommand({
    AccessToken: accessToken,
    PreviousPassword: oldPassword,
    ProposedPassword: newPassword
  })

  await cognitoClient.send(command)

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Password changed successfully' })
  }
}
