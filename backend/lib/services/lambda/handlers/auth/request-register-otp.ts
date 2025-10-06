import { oneTimeCodesTableName } from '@marketplace/constants'
import { OneTimePassword } from '@marketplace/types'
import { APIGatewayProxyEvent } from 'aws-lambda'
import {
  createOneTimePassword
} from '../../helpers/create-one-time-password'
import { get } from '../../helpers/dynamo-helpers/get'
import { sendRegistrationEmail } from '../../helpers/emails/send-registration-email'
import { rateLimitedHandler } from '../../helpers/rate-limited-handler'

export const requestRegisterOtp = rateLimitedHandler(async function (event: APIGatewayProxyEvent) {
  const { body } = event
  const { email } = JSON.parse(body || '{}')
  if (!email) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing email' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      }
    }
  }
  const otp = await get<OneTimePassword>({
    tableName: oneTimeCodesTableName!,
    key: {
      email,
      type: 'registration'
    }
  })
  let allowOverwrite = false
  // if created over 5 mins ago allow overwrite
  if (otp && new Date(otp.created_at) < new Date(Date.now() - 5 * 60 * 1000)) {
    allowOverwrite = true
  }
  if (otp && !allowOverwrite) {
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'A One-Time Password (OTP) has already been sent. Please check your email or try again in 5 minutes.' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      }
    }
  }
  const newOtp = await createOneTimePassword({
    email,
    type: 'registration'
  })
  // Send OTP to user via email
  await sendRegistrationEmail({
    to: email,
    code: newOtp
  })
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Please check your inbox for the One-Time Password (OTP).' }),
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true
    }
  }
})
