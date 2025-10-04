import { rateLimitedHandler } from '../../helpers/rate-limited-handler'
import {
  logMeterEvent, MeterEventParams 
} from '../../helpers/stripe/log-meter-event'

export const logMeterEventHandler = rateLimitedHandler(async (event) => {
  try {
    const eventBody = JSON.parse(event.body || '{}')
    if (eventBody.purchase_id == null) {
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
    if (eventBody.user_id == null) {
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
    if (eventBody.value == null || typeof eventBody.value !== 'number') {
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
    if (eventBody.metadata != null && typeof eventBody.metadata !== 'object') {
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
    const meterEventParams: MeterEventParams = {
      purchaseId: eventBody.purchase_id,
      userId: eventBody.user_id,
      value: eventBody.value,
      metadata: eventBody.metadata
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
