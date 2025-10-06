import { APIGatewayProxyEvent } from 'aws-lambda'
import { addUserToOrganization } from '../../helpers/organizations/add-user-to-organization'

export const add = async (event: APIGatewayProxyEvent) => {
  const {
    user_id: userId,
    organization_id: organizationId
  } = JSON.parse(event.body ?? '{}')
  try {
    // Add user to organization logic here
    if (userId == null || organizationId == null) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing user_id or organization_id' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true
        }
      }
    }
    await addUserToOrganization({
      userId,
      organizationId,
      admin: false
    })
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'User added to organization successfully' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      }
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: (error as Error)?.message }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      }
    }
  }
}