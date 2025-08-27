import Stripe from 'stripe'
import {
  BillingMeter, CreateMeterRequest 
} from './types'

let stripe: Stripe | undefined

export const createMeter = async (
  request: CreateMeterRequest
) => {
  try {
    const { body } = request

    // Initialize Stripe if not already done
    if (!stripe) {
      if (!process.env.STRIPE_SECRET_KEY) {
        return {
          error: 'STRIPE_SECRET_KEY environment variable not set'
        }
      }
      stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    }

    // Validate required fields
    if (!body.display_name || !body.event_name || !body.default_aggregation?.formula) {
      return {
        error: 'Missing required fields: display_name, event_name, and default_aggregation.formula are required'
      }
    }

    // Create the billing meter in Stripe
    const meterParams: Stripe.Billing.MeterCreateParams = {
      display_name: body.display_name,
      event_name: body.event_name,
      default_aggregation: {
        formula: body.default_aggregation.formula
      }
    }

    const stripeMeter = await stripe.billing.meters.create(meterParams)

    // Convert Stripe response to our format
    const createdMeter: BillingMeter = {
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
        message: 'Billing meter created successfully',
        meter: createdMeter
      }
    }
  } catch (error) {
    console.error('Error creating billing meter:', error)
    
    // Handle Stripe-specific errors
    if (error instanceof Error && 'type' in error) {
      const stripeError = error as Stripe.StripeRawError
      return {
        error: `Stripe error: ${stripeError.message}`,
        details: stripeError.code || 'unknown_stripe_error'
      }
    }
    
    return {
      error: 'Failed to create billing meter',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}