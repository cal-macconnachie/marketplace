import { APIGatewayProxyEvent } from 'aws-lambda'
import { getOrganizationById } from '../../helpers/organizations/get-organization-by-id'
import { getStripeClient } from '../../helpers/stripe/stripe-client'
import { getUserByEmail } from '../../helpers/users/get-user-by-email'

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
    const {
      amount, currency = 'usd' 
    } = body

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

    let paymentMethodToUse: string | null = null
    let paymentMethodTypes: string[] = []

    // First, try to get the user's default payment method from their Stripe customer
    if (user.stripe_id) {
      try {
        const customer = await stripe.customers.retrieve(
          user.stripe_id,
        )

        // Check if customer has a default payment method
        if (customer && !customer.deleted) {
          const defaultPaymentMethodId =
            typeof customer.invoice_settings?.default_payment_method === 'string'
              ? customer.invoice_settings.default_payment_method
              : customer.invoice_settings?.default_payment_method?.id

          if (defaultPaymentMethodId) {
            const defaultPaymentMethod = await stripe.paymentMethods.retrieve(
              defaultPaymentMethodId,
              { stripeAccount: organization.stripe_account_id }
            )

            // Only use if it's a card (universal support)
            if (defaultPaymentMethod.type === 'card') {
              paymentMethodToUse = defaultPaymentMethodId
              paymentMethodTypes = ['card']
              console.log(`Using customer's default card payment method ${paymentMethodToUse}`)
            }
          }
        }
      } catch (error) {
        console.warn('Failed to retrieve customer or default payment method:', error)
        // Continue to fallback logic
      }
    }

    // Fallback: Look for any card payment methods if no default found
    if (!paymentMethodToUse) {
      const cardPaymentMethods = await stripe.paymentMethods.list(
        {
          type: 'card', limit: 10
        },
        { stripeAccount: organization.stripe_account_id }
      )

      if (cardPaymentMethods.data.length > 0) {
        // Use first available card payment method
        paymentMethodToUse = cardPaymentMethods.data[0].id
        paymentMethodTypes = ['card']
        console.log(`Using first available card payment method ${paymentMethodToUse}`)
      }
    }

    // Final fallback: Check if we have a US bank account we can use
    if (!paymentMethodToUse) {
      // No card found, check if we have a US bank account we can use
      const bankPaymentMethod = await stripe.paymentMethods.retrieve(
        organization.stripe_bank_account_id,
        { stripeAccount: organization.stripe_account_id }
      )

      // Only use bank account if it's explicitly a US bank account
      if (bankPaymentMethod.type === 'us_bank_account') {
        paymentMethodToUse = organization.stripe_bank_account_id
        paymentMethodTypes = ['us_bank_account']
        console.log(`Using US bank account ${paymentMethodToUse}`)
      } else {
        // Not a US bank account and no card available
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: 'No supported payment method found. Please add a credit/debit card for automatic top-ups, or use manual bank transfer to your Stripe balance.',
            errorCode: 'NO_SUPPORTED_PAYMENT_METHOD',
            bankAccountType: bankPaymentMethod.type
          }),
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true,
            'Content-Type': 'application/json'
          }
        }
      }
    }

    // Create a PaymentIntent on the connected account
    // This will debit the payment method and add funds to the connected account's Stripe balance
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      payment_method: paymentMethodToUse,
      confirm: true,
      description: `Account top-up for ${organization.name || 'organization'}`,
      metadata: {
        organization_id: organization.id,
        type: 'account_topup',
        requested_by: userEmail
      },
      payment_method_types: paymentMethodTypes
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
