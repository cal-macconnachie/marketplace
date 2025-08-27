import Stripe from 'stripe'
import {
  BillingMeter, ListMetersRequest 
} from './types'

let stripe: Stripe | undefined

export const listMeters = async (
  request: ListMetersRequest
) => {
  try {
    // Initialize Stripe if not already done
    if (!stripe) {
      if (!process.env.STRIPE_SECRET_KEY) {
        return {
          error: 'STRIPE_SECRET_KEY environment variable not set'
        }
      }
      stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    }

    // Parse query parameters
    const status = request.queryStringParameters?.status
    const limit = request.queryStringParameters?.limit ? 
      parseInt(request.queryStringParameters.limit, 10) : 100

    // List billing meters from Stripe
    const listParams: Stripe.Billing.MeterListParams = {
      limit: Math.min(limit, 100) // Stripe API limit
    }

    if (status) {
      listParams.status = status
    }

    const stripeMeters = await stripe.billing.meters.list(listParams)

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
      updated: meter.updated
    }))

    return {
      data: meters
    }
  } catch (error) {
    console.error('Error listing billing meters:', error)
    
    // Handle Stripe-specific errors
    if (error instanceof Error && 'type' in error) {
      const stripeError = error as Stripe.StripeRawError
      return {
        error: `Stripe error: ${stripeError.message}`,
        details: stripeError.code || 'unknown_stripe_error'
      }
    }
    
    return {
      error: 'Failed to list billing meters',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}