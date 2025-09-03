import Stripe from 'stripe'
import { getStripeClient } from '../../helpers/stripe/stripe-client'
import {
  BillingMeter, ListMetersRequest 
} from './types'

export const listMeters = async (
  request: ListMetersRequest
) => {
  try {
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

    // Parse query parameters
    const status = request.queryStringParameters?.status
    const account_id = request.queryStringParameters?.account_id
    const limit = request.queryStringParameters?.limit ? 
      parseInt(request.queryStringParameters.limit, 10) : 100

    // Validate account_id for connected account operations
    if (!account_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'account_id is required for listing meters'
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    // List billing meters from Stripe using connected account
    const listParams: Stripe.Billing.MeterListParams = {
      limit: Math.min(limit, 100) // Stripe API limit
    }

    if (status) {
      listParams.status = status
    }

    const stripeMeters = await stripe.billing.meters.list(listParams, {
      stripeAccount: account_id
    })

    // Convert Stripe response to our format
    const meters: BillingMeter[] = stripeMeters.data.map(meter => ({
      id: meter.id,
      display_name: meter.display_name,
      event_name: meter.event_name,
      default_aggregation: {
        formula: meter.default_aggregation.formula as 'sum' | 'count' | 'last'
      },
      status: meter.status as 'active' | 'inactive',
      created: meter.created,
      updated: meter.updated,
      account_id: account_id
    }))

    return {
      statusCode: 200,
      body: JSON.stringify(meters),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } catch (error) {
    console.error('Error listing billing meters:', error)
    
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
        error: 'Failed to list billing meters',
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
