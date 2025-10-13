import { usersTableName } from '@marketplace/constants'
import { User } from '@marketplace/types'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { get } from '../../helpers/dynamo-helpers/get'
import { rateLimitedHandler } from '../../helpers/rate-limited-handler'
import { createUpdateUser } from '../../helpers/users/create-update-user'
import { getUserByEmail } from '../../helpers/users/get-user-by-email'

export const guestRegister = rateLimitedHandler(async (event: APIGatewayProxyEvent) => {
  try {
    const {
      email,
      family_name: familyName,
      given_name: givenName,
      phone_number: phoneNumber,
      address,
    } = JSON.parse(event.body ?? '{}')
    // if any fields are nullable, return 400
    if (!email || !familyName || !givenName || !phoneNumber || !address) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing required fields' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true
        }
      }
    }
    const existingUser = await getUserByEmail(email)
    if (existingUser && existingUser.cognito_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'User with this email already exists, please log in' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true
        }
      }
    }
    const newUser = await createUpdateUser({
      email,
      family_name: familyName,
      given_name: givenName,
      phone_number: phoneNumber,
      address,
    })
    return {
      statusCode: 200,
      body: JSON.stringify(newUser),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      }
    }
  } catch (error) {
    console.error('Error in guestRegister:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      }
    }
  }
})

export const checkGuestStripeCustomerStatus = rateLimitedHandler(async (event: APIGatewayProxyEvent) => {
  try {
    const { id } = event.pathParameters ?? {}
    if (!id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'ID is required' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true
        }
      }
    }
    const existingUser = await get<User>({
      tableName: usersTableName!,
      key: { id }
    })
    if (!existingUser) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'User not found' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true
        }
      }
    }
    return {
      statusCode: 200,
      body: JSON.stringify({ has_stripe_customer: !!existingUser.stripe_id }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      }
    }
  } catch (error) {
    console.error('Error in checkGuestStripeCustomerStatus:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      }
    }
  }
}, {
  maxRequests: 60,
  windowMs: 60000 // 60 requests per minute for polling
})