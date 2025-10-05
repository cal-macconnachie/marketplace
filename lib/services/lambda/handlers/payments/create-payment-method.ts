import { APIGatewayProxyEvent } from 'aws-lambda'
import { create } from '../../helpers/dynamo-helpers/create'
import { PaymentMethod } from '../payment-methods'
import { getStripeClient } from '../../helpers/stripe/stripe-client'
import { get } from '../../helpers/dynamo-helpers/get'
import { User } from '../users'
import { Organization } from '../organizations'
import { update } from '../../helpers/dynamo-helpers/update'

export const createPaymentMethod = async (event: APIGatewayProxyEvent) => {
  try {
    const {
      user_id,
      id,
      last_four_digits,
      brand,
      expiry_month,
      expiry_year
    } = JSON.parse(event.body ?? '{}')
    if (!user_id || !id || !last_four_digits || !brand || !expiry_month || !expiry_year) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    const user = await get<User>({
      tableName: process.env.USERS_TABLE!,
      key: {
        id: user_id
      }
    })
    if (user == null) {
      throw new Error(`User not found: ${user_id}`)
    }
    if (user.stripe_id == null) {
      throw new Error(`User does not have a Stripe ID: ${user_id}`)
    }
    if (!user.is_organization_admin) {
      throw new Error('User must be an org admin to add payment methods')
    }
    const org = await get<Organization>({
      tableName: process.env.ORGANIZATIONS_TABLE!,
      key: {
        id: user.organization_id
      }
    })
    if (org == null) {
      throw new Error(`Organization not found: ${user.organization_id}`)
    }
    // create stripe setupIntent
    const stripe = getStripeClient()
    const setupIntent = await stripe.setupIntents.create({
      customer: user.stripe_id,
      payment_method: id,
      confirm: true,
      usage: 'off_session',
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never'
      },
      metadata: {
        user_id,
        payment_method_id: id
      }
    })
    if (!setupIntent) {
      throw new Error('Failed to create setup intent')
    }

    let paymentMethodStatus: 'pending_verification' | 'active' = 'active'
    let nextAction = null

    if (setupIntent.status === 'requires_action' && setupIntent.next_action) {
      // 3DS or other verification required
      paymentMethodStatus = 'pending_verification'
      nextAction = setupIntent.next_action
    } else if (setupIntent.status !== 'succeeded') {
      throw new Error(`Setup intent failed with status: ${setupIntent.status}`)
    }

    // Only attach and set as default if verification succeeded immediately
    if (setupIntent.status === 'succeeded') {
      await stripe.paymentMethods.attach(id, {
        customer: user.stripe_id
      })
      await stripe.customers.update(user.stripe_id, {
        invoice_settings: {
          default_payment_method: id
        }
      })
    }

    const paymentMethod = await create<PaymentMethod>({
      tableName: process.env.PAYMENT_METHODS_TABLE!,
      key: {
        user_id,
        id
      },
      record: {
        user_id,
        id,
        last_four_digits,
        brand,
        expiry_month,
        expiry_year,
        status: paymentMethodStatus
      },
      returnCreated: true
    })
    // Only set as org default if verification succeeded and org has no default
    if (org.default_payment_method == null && setupIntent.status === 'succeeded') {
      await update<Organization>({
        tableName: process.env.ORGANIZATIONS_TABLE!,
        key: {
          id: org.id
        },
        updates: {
          default_payment_method: {
            id: paymentMethod.id,
            user_id: user.id
          }
        }
      })
    }

    const responseBody: any = {
      ...paymentMethod
    }

    // Include next_action if verification is required
    if (nextAction) {
      responseBody.requires_action = true
      responseBody.next_action = nextAction
      responseBody.setup_intent_client_secret = setupIntent.client_secret
    }

    return {
      statusCode: 200,
      body: JSON.stringify(responseBody),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: (error as Error).message }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
}