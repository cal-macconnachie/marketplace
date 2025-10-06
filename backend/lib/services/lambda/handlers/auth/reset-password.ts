import {
  AdminSetUserPasswordCommand, CognitoIdentityProviderClient 
} from "@aws-sdk/client-cognito-identity-provider"
import { APIGatewayProxyEvent } from "aws-lambda"
import { get } from '../../helpers/dynamo-helpers/get'
import { OneTimePassword } from '../../helpers/create-one-time-password'
import { deleteItem } from '../../helpers/dynamo-helpers/delete'
import { rateLimitedHandler } from '../../helpers/rate-limited-handler'
const cognitoClient = new CognitoIdentityProviderClient({})

export const resetPassword = rateLimitedHandler(async function (event: APIGatewayProxyEvent) {
  const { body } = event
  const {
    email, newPassword, otp
  } = JSON.parse(body || '{}')
  if (email == null || newPassword == null || otp == null) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing required fields' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      }
    }
  }
  if (isNaN(parseInt(otp)) || parseInt(otp) < 100000 || parseInt(otp) > 999999) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Invalid OTP' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      }
    }
  }
  const oneTimePassword = await get<OneTimePassword>({
    tableName: process.env.ONE_TIME_CODES_TABLE!,
    key: {
      email,
      type: 'password-reset'
    }
  })
  const now = new Date()
  const expiresAt = oneTimePassword?.expires_at ? new Date(oneTimePassword.expires_at) : undefined
  const isValid =
    oneTimePassword?.one_time_password === otp &&
    (!!expiresAt ? expiresAt > now : true)

  if (isValid) {
    await cognitoClient.send(new AdminSetUserPasswordCommand({
      UserPoolId: process.env.USER_POOL_ID!,
      Username: email,
      Password: newPassword,
      Permanent: true
    }))
    // Best-effort delete of the OTP to prevent reuse
    try {
      await deleteItem({
        tableName: process.env.ONE_TIME_CODES_TABLE!,
        key: {
          email, type: 'password-reset' 
        }
      })
    } catch (e) {
      console.warn('Failed to delete used OTP', e)
    }
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Password changed successfully' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      }
    }
  }
  return {
    statusCode: 400,
    body: JSON.stringify({ message: 'Invalid OTP' }),
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true
    }
  }
})
