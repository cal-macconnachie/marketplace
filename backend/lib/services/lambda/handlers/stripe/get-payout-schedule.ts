import { APIGatewayProxyEvent } from 'aws-lambda'
import { getUserByEmail } from '../../helpers/users/get-user-by-email'
import { getOrganizationById } from '../../helpers/organizations/get-organization-by-id'
import { getStripeClient } from '../../helpers/stripe/stripe-client'

export const getPayoutScheduleHandler = async (event: APIGatewayProxyEvent) => {
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

    // Get account details from Stripe
    const stripe = getStripeClient()
    const account = await stripe.accounts.retrieve(organization.stripe_account_id)

    if (!account.settings?.payouts) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: 'Payout settings not found for this account'
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        schedule: account.settings.payouts.schedule,
        statement_descriptor: account.settings.payouts.statement_descriptor,
        debit_negative_balances: account.settings.payouts.debit_negative_balances
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } catch (error) {
    console.error('Error getting payout schedule:', error)

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: (error as Error).message || 'Failed to get payout schedule'
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
}
