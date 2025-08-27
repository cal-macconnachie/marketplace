import Stripe from 'stripe'
import { BillingMeter, DeactivateMeterRequest } from './types'

let stripe: Stripe | undefined

export const deactivateMeter = async (
  request: DeactivateMeterRequest
) => {
  try {
    const { pathParameters } = request

    // Initialize Stripe if not already done
    if (!stripe) {
      if (!process.env.STRIPE_SECRET_KEY) {
        return {
          error: 'STRIPE_SECRET_KEY environment variable not set'
        }
      }
      stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    }

    if (!pathParameters?.id) {
      return {
        error: 'Meter ID is required'
      }
    }

    const meterId = pathParameters.id

    // Deactivate the billing meter in Stripe
    const stripeMeter = await stripe.billing.meters.deactivate(meterId)

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
      updated: stripeMeter.updated
    }

    return {
      data: {
        message: 'Billing meter deactivated successfully',
        meter: deactivatedMeter
      }
    }
  } catch (error) {
    console.error('Error deactivating billing meter:', error)
    
    // Handle Stripe-specific errors
    if (error instanceof Error && 'type' in error) {
      const stripeError = error as Stripe.StripeError
      return {
        error: `Stripe error: ${stripeError.message}`,
        details: stripeError.code || 'unknown_stripe_error'
      }
    }
    
    return {
      error: 'Failed to deactivate billing meter',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}