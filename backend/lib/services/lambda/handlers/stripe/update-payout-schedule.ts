import { APIGatewayProxyEvent } from 'aws-lambda'
import { getUserByEmail } from '../../helpers/users/get-user-by-email'
import { getOrganizationById } from '../../helpers/organizations/get-organization-by-id'
import { getStripeClient } from '../../helpers/stripe/stripe-client'
import Stripe from 'stripe'

interface UpdatePayoutScheduleRequest {
  interval?: 'manual' | 'daily' | 'weekly' | 'monthly'
  delay_days?: number
  weekly_anchor?: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
  monthly_anchor?: number
}

export const updatePayoutScheduleHandler = async (event: APIGatewayProxyEvent) => {
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

    // Parse request body
    const body: UpdatePayoutScheduleRequest = JSON.parse(event.body || '{}')
    const { interval, delay_days, weekly_anchor, monthly_anchor } = body

    if (!interval) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Interval is required' }),
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

    // Build payout schedule object
    const schedule: Stripe.AccountUpdateParams.Settings.Payouts.Schedule = {
      interval
    }

    // Add optional parameters based on interval
    if (delay_days !== undefined) {
      schedule.delay_days = delay_days
    }

    if (interval === 'weekly' && weekly_anchor) {
      schedule.weekly_anchor = weekly_anchor
    }

    if (interval === 'monthly' && monthly_anchor) {
      schedule.monthly_anchor = monthly_anchor
    }

    // Update account settings in Stripe
    const stripe = getStripeClient()
    const account = await stripe.accounts.update(organization.stripe_account_id, {
      settings: {
        payouts: {
          schedule
        }
      }
    })

    console.log(`Updated payout schedule for organization ${organization.id}`)

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        schedule: account.settings?.payouts?.schedule
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } catch (error) {
    console.error('Error updating payout schedule:', error)

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: (error as Error).message || 'Failed to update payout schedule'
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
}
