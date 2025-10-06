import Stripe from 'stripe'
import { getStripeClient } from '../../helpers/stripe/stripe-client'
import {
  BillingMeter 
} from '@marketplace/types'
import { APIGatewayProxyEvent } from 'aws-lambda'

export const deactivateMeter = async (
  request: APIGatewayProxyEvent
) => {
  try {
    const {
      pathParameters, queryStringParameters 
    } = request

    // Get the Stripe client (supports connected accounts)
    const stripe = getStripeClient()
    if (!process.env.STRIPE_SECRET_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'STRIPE_SECRET_KEY environment variable not set'
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    if (!pathParameters?.id) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Meter ID is required'
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    const meterId = pathParameters.id
    const account_id = queryStringParameters?.account_id

    // Validate account_id for connected account operations
    if (!account_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'account_id is required for meter deactivation'
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    // Deactivate the billing meter in Stripe using connected account
    const stripeMeter = await stripe.billing.meters.deactivate(meterId, {}, {
      stripeAccount: account_id
    })

    // Convert Stripe response to our format
    const deactivatedMeter: BillingMeter = {
      id: stripeMeter.id,
      display_name: stripeMeter.display_name,
      event_name: stripeMeter.event_name,
      default_aggregation: {
        formula: stripeMeter.default_aggregation.formula as 'sum' | 'count' | 'last'
      },
      status: stripeMeter.status as 'active' | 'inactive',
      created: stripeMeter.created,
      updated: stripeMeter.updated,
      account_id: account_id
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Billing meter deactivated successfully',
        meter: deactivatedMeter
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } catch (error) {
    console.error('Error deactivating billing meter:', error)
    
    // Handle Stripe-specific errors
    if (error instanceof Error && 'type' in error) {
      const stripeError = error as Stripe.StripeRawError
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: `Stripe error: ${stripeError.message}`,
          details: stripeError.code || 'unknown_stripe_error'
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to deactivate billing meter',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
}