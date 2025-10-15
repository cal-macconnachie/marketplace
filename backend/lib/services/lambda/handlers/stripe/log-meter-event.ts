import { MeterEventParams } from '@marketplace/types'
import { getUserFromEvent } from '../../helpers/get-user-from-event'
import { rateLimitedHandler } from '../../helpers/rate-limited-handler'
import {
  logMeterEvent
} from '../../helpers/stripe/log-meter-event'

export const logMeterEventHandler = rateLimitedHandler(async (event) => {
  try {
    const {
      purchase_id, user_id, value, metadata
    } = JSON.parse(event.body || '{}')
    if (purchase_id == null) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'purchase_id is required' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    if (user_id == null) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'user_id is required' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    if (value == null || typeof value !== 'number') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'value is required and must be a number' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    if (metadata != null && typeof metadata !== 'object') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'metadata must be an object if provided' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    const user = await getUserFromEvent(event)
    if (user == null || user.stripe_id == null) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    const meterEventParams: MeterEventParams = {
      purchaseId: purchase_id,
      customerId: user.stripe_id,
      userId: user_id,
      value: value,
      metadata: metadata
    }
    const result = await logMeterEvent(meterEventParams)

    if (!result.success) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: result.error, details: result.details
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Event logged successfully',
        event: result.event
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } catch (error) {
    console.error('Error in logMeterEventHandler:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
})
