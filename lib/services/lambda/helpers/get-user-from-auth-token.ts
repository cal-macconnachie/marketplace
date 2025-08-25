import {
  CognitoIdentityProviderClient, GetUserCommand 
} from '@aws-sdk/client-cognito-identity-provider'
import { User } from '../handlers/users'
import { getUserByEmail } from './users/get-user-by-email'

const cognitoClient = new CognitoIdentityProviderClient({})

export async function getUserFromToken(accessToken: string): Promise<User | undefined> {
  try {
    // Get user info from Cognito
    const getUserCommand = new GetUserCommand({
      AccessToken: accessToken
    })
    
    const cognitoResponse = await cognitoClient.send(getUserCommand)
    const userAttributes = cognitoResponse.UserAttributes || []
    
    // Extract email from Cognito user attributes
    const email = userAttributes.find(attr => attr.Name === 'email')?.Value
    
    if (!email) {
      console.error('No email found in Cognito user attributes')
      return
    }

    // Get user from database using email
    const user = await getUserByEmail(email)
    
    if (!user) {
      console.error(`User not found in database for email: ${email}`)
      return
    }

    return user
    
  } catch (error) {
    console.error('Error getting user from token:', error)
    return
  }
}
