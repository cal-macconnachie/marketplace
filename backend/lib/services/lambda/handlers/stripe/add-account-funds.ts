import { APIGatewayProxyEvent } from 'aws-lambda'
import { getUserByEmail } from '../../helpers/users/get-user-by-email'
import { getOrganizationById } from '../../helpers/organizations/get-organization-by-id'
import { getStripeClient } from '../../helpers/stripe/stripe-client'

interface AddFundsRequest {
  amount: number // Amount in cents
  currency?: string
}

export const addAccountFundsHandler = async (event: APIGatewayProxyEvent) => {
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
    const body: AddFundsRequest = JSON.parse(event.body || '{}')
    const { amount, currency = 'usd' } = body

    if (!amount || amount <= 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid amount. Must be greater than 0.' }),
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

    // Check if organization has a linked bank account
    if (!organization.stripe_bank_account_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'No bank account linked to this organization. Please link a bank account first.'
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    const stripe = getStripeClient()

    // Create a PaymentIntent on the connected account using their bank account
    // This will debit the bank account and add funds to the connected account's Stripe balance
    // Supports both US (us_bank_account) and Canadian (acss_debit) bank accounts
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      payment_method: organization.stripe_bank_account_id,
      confirm: true,
      description: `Account top-up for ${organization.name || 'organization'}`,
      metadata: {
        organization_id: organization.id,
        type: 'account_topup',
        requested_by: userEmail
      },
      payment_method_types: ['us_bank_account', 'acss_debit']
    }, {
      stripeAccount: organization.stripe_account_id
    })

    console.log(`Created payment intent ${paymentIntent.id} for organization ${organization.id}`)

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        payment_intent_id: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        created: paymentIntent.created
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } catch (error) {
    console.error('Error adding account funds:', error)

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: (error as Error).message || 'Failed to add account funds'
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
}
