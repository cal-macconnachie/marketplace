import { rateLimitedHandler } from '../../helpers/rate-limited-handler'
import {
  logMeterEvent, MeterEventParams 
} from '../../helpers/stripe/log-meter-event'

export const logMeterEventHandler = rateLimitedHandler(async (event) => {
  try {
    const eventBody = JSON.parse(event.body || '{}')
    if (eventBody.event_name == null) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'event_name is required' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    if (eventBody.customer_id == null) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'customer_id is required' }),
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
    const metereventParams: MeterEventParams = {
      eventName: eventBody.event_name,
      customerId: eventBody.customer_id,
      value: eventBody.value,
      metadata: eventBody.metadata
    }
    await logMeterEvent(metereventParams)
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Event logged' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } catch {
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
