import Stripe from 'stripe'
import { getStripeClient } from '../../helpers/stripe/stripe-client'
import { BillingMeter, DeactivateMeterRequest } from './types'

export const deactivateMeter = async (
  request: DeactivateMeterRequest
) => {
  try {
    const { pathParameters, queryStringParameters } = request

    // Get the Stripe client (supports connected accounts)
    const stripe = getStripeClient()
    if (!process.env.STRIPE_SECRET_KEY) {
      return {
        error: 'STRIPE_SECRET_KEY environment variable not set'
      }
    }

    if (!pathParameters?.id) {
      return {
        error: 'Meter ID is required'
      }
    }

    const meterId = pathParameters.id
    const account_id = queryStringParameters?.account_id

    // Validate account_id for connected account operations
    if (!account_id) {
      return {
        error: 'account_id is required for meter deactivation'
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