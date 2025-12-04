import { APIGatewayProxyEvent } from 'aws-lambda'
import { getUserByEmail } from '../../helpers/users/get-user-by-email'
import { getOrganizationById } from '../../helpers/organizations/get-organization-by-id'
import { getStripeClient } from '../../helpers/stripe/stripe-client'

export const getAccountBalanceHandler = async (event: APIGatewayProxyEvent) => {
  try {
    const userEmail = event.requestContext.authorizer?.claims?.email
    if (!userEmail) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized - user email not found' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    // Get user and organization
    const user = await getUserByEmail(userEmail)

    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'User not found' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    const organizationId = user.organization_id
    const organization = await getOrganizationById(organizationId)

    if (!organization) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Organization not found' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    // Check if organization has a connected account
    if (!organization.stripe_account_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'No connected Stripe account found for this organization.'
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    // Get balance from Stripe
    const stripe = getStripeClient()
    const balance = await stripe.balance.retrieve({
      stripeAccount: organization.stripe_account_id
    })

    return {
      statusCode: 200,
      body: JSON.stringify({
        available: balance.available,
        pending: balance.pending,
        instant_available: balance.instant_available
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } catch (error) {
    console.error('Error getting account balance:', error)

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: (error as Error).message || 'Failed to get account balance'
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
}
