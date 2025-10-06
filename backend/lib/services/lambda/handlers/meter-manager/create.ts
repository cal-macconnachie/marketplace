import Stripe from 'stripe'
import { getStripeClient } from '../../helpers/stripe/stripe-client'
import {
  BillingMeter 
} from './types'
import { APIGatewayProxyEvent } from 'aws-lambda'

export const createMeter = async (
  request: APIGatewayProxyEvent
) => {
  try {
    const body = JSON.parse(request.body ?? '{}')

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

    // Validate required fields
    if (!body.display_name || !body.event_name || !body.default_aggregation?.formula) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing required fields: display_name, event_name, and default_aggregation.formula are required'
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
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
      statusCode: 201,
      body: JSON.stringify({
        message: 'Billing meter created successfully',
        meter: createdMeter
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } catch (error) {
    console.error('Error creating billing meter:', error)
    
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
        error: 'Failed to create billing meter',
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