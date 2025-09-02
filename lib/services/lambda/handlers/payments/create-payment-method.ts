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
    // create stripe paymentIntent
    const stripe = getStripeClient()
    const setupIntent = await stripe.setupIntents.create({
      customer: user.stripe_id,
      payment_method: id,
      confirm: true,
      usage: 'off_session',
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never'
      }
    })
    if (!setupIntent) {
      throw new Error('Failed to create setup intent')
    }
    if (setupIntent.status !== 'succeeded') {
      throw new Error(`Setup intent failed with status: ${setupIntent.status}`)
    }
    await stripe.paymentMethods.attach(id, {
      customer: user.stripe_id
    })
    await stripe.customers.update(user.stripe_id, {
      invoice_settings: {
        default_payment_method: id
      }
    })

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
        expiry_year
      },
      returnCreated: true
    })
    if (org.default_payment_method == null) {
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
    return {
      statusCode: 200,
      body: JSON.stringify(paymentMethod),
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