import { User } from '@marketplace/types'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { getUserByEmail } from './users/get-user-by-email'

export const getUserFromEvent = async (event: APIGatewayProxyEvent): Promise<User> => {
  const email = event.requestContext.authorizer?.claims?.email
  if (!email) {
    throw new Error('Unauthorized: No user found in event')
  }
  const user = await getUserByEmail(email)
  if (!user) {
    throw new Error('Unauthorized: User not found')
  }
  return user
}