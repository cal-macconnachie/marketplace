import Stripe from 'stripe'
import { getStripeClient } from '../../helpers/stripe/stripe-client'
import {
  BillingMeter, CreateMeterRequest 
} from './types'

export const createMeter = async (
  request: CreateMeterRequest
) => {
  try {
    const { body } = request

    // Get the Stripe client (supports connected accounts)
    const stripe = getStripeClient()
    if (!process.env.STRIPE_SECRET_KEY) {
      return {
        error: 'STRIPE_SECRET_KEY environment variable not set'
      }
    }

    // Validate required fields
    if (!body.display_name || !body.event_name || !body.default_aggregation?.formula) {
      return {
        error: 'Missing required fields: display_name, event_name, and default_aggregation.formula are required'
      }
    }

    // Validate account_id for connected account operations
    if (!body.account_id) {
      return {
        error: 'account_id is required for meter creation'
      }
    }

    // Create the billing meter in Stripe using connected account
    const meterParams: Stripe.Billing.MeterCreateParams = {
      display_name: body.display_name,
      event_name: body.event_name,
      default_aggregation: {
        formula: body.default_aggregation.formula
      }
    }

    const stripeMeter = await stripe.billing.meters.create(meterParams, {
      stripeAccount: body.account_id
    })

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
      updated: stripeMeter.updated,
      account_id: body.account_id
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