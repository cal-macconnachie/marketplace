import { APIGatewayProxyEvent } from 'aws-lambda'
import { getOrganizationById } from '../../helpers/organizations/get-organization-by-id'
import { createDestinationCharge } from '../../helpers/stripe/create-destination-charge'
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
    let useCardOnPlatform = false // Track if we're using a platform-owned card

    // First, try to get the user's default payment method from their Stripe customer (PLATFORM)
    if (user.stripe_id) {
      try {
        const customer = await stripe.customers.retrieve(user.stripe_id)

        // Check if customer has a default payment method
        if (customer && !customer.deleted) {
          const defaultPaymentMethodId =
            typeof customer.invoice_settings?.default_payment_method === 'string'
              ? customer.invoice_settings.default_payment_method
              : customer.invoice_settings?.default_payment_method?.id

          if (defaultPaymentMethodId) {
            const defaultPaymentMethod = await stripe.paymentMethods.retrieve(
              defaultPaymentMethodId
            )

            // Only use if it's a card (universal support)
            if (defaultPaymentMethod.type === 'card') {
              paymentMethodToUse = defaultPaymentMethodId
              useCardOnPlatform = true
              console.log(`Using customer's default card payment method ${paymentMethodToUse}`)
            }
          }
        }
      } catch (error) {
        console.warn('Failed to retrieve customer or default payment method:', error)
        // Continue to fallback logic
      }
    }

    // Fallback: Look for any card payment methods on PLATFORM if no default found
    if (!paymentMethodToUse && user.stripe_id) {
      try {
        const cardPaymentMethods = await stripe.paymentMethods.list({
          customer: user.stripe_id,
          type: 'card',
          limit: 10
        })

        if (cardPaymentMethods.data.length > 0) {
          paymentMethodToUse = cardPaymentMethods.data[0].id
          useCardOnPlatform = true
          console.log(`Using first available card payment method ${paymentMethodToUse}`)
        }
      } catch (error) {
        console.warn('Failed to list payment methods:', error)
      }
    }

    // Final fallback: Check if we have a US bank account on CONNECTED ACCOUNT
    if (!paymentMethodToUse && organization.stripe_bank_account_id) {
      try {
        const bankPaymentMethod = await stripe.paymentMethods.retrieve(
          organization.stripe_bank_account_id,
          { stripeAccount: organization.stripe_account_id }
        )

        // Only use bank account if it's explicitly a US bank account
        if (bankPaymentMethod.type === 'us_bank_account') {
          paymentMethodToUse = organization.stripe_bank_account_id
          useCardOnPlatform = false
          console.log(`Using US bank account ${paymentMethodToUse}`)
        }
      } catch (error) {
        console.warn('Failed to retrieve bank payment method:', error)
      }
    }

    // Error if no payment method found
    if (!paymentMethodToUse) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'No supported payment method found. Please add a credit/debit card for automatic top-ups, or use manual bank transfer to your Stripe balance.',
          errorCode: 'NO_SUPPORTED_PAYMENT_METHOD'
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    let paymentIntent

    if (useCardOnPlatform) {
      // Charge card on PLATFORM and transfer to connected account using existing helper
      console.log('Charging card on platform and transferring to connected account')
      paymentIntent = await createDestinationCharge({
        amount,
        currency,
        paymentMethodId: paymentMethodToUse,
        user,
        destinationAccountId: organization.stripe_account_id,
        fullAmountToDestination: true
      })
    } else {
      // Charge bank account directly on CONNECTED ACCOUNT
      console.log('Charging bank account directly on connected account')
      paymentIntent = await stripe.paymentIntents.create(
        {
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
          payment_method_types: ['us_bank_account']
        },
        {
          stripeAccount: organization.stripe_account_id
        }
      )
    }

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
