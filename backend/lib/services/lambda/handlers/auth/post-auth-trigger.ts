import { PostAuthenticationTriggerEvent } from 'aws-lambda'
import { createUpdateUser } from '../../helpers/users/create-update-user'
import { v4 } from 'uuid'
import { User } from '../users'
import { getUserByEmail } from '../../helpers/users/get-user-by-email'

export const postAuthTrigger = async (event: PostAuthenticationTriggerEvent) => {
  console.log(event)
  const { userAttributes } = event.request
  const email = userAttributes.email
  const cognitoId = userAttributes.sub
  
  if (!email || !cognitoId) {
    console.error('Missing required attributes: email or sub')
    return event
  }

  try {
    // Check if user already exists in DynamoDB
    const existingUser = await getUserByEmail(email)

    if (!existingUser) {
      // Create new user record for social sign-in
      const userData: Partial<User> = {
        id: v4(),
        email,
        cognito_id: cognitoId,
        is_organization_admin: true, // Default to false, can be updated later
        // Add social provider info if available
        ...(userAttributes.identities && {
          social_provider: JSON.parse(userAttributes.identities)[0]?.providerName
        })
      }

      await createUpdateUser(userData)

    }
  } catch (error) {
    console.error('Error in post-authentication trigger:', error)
    // Don't throw error to avoid blocking authentication
  }

  return event
}