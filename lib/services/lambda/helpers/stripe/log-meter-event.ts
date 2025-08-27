import { getStripeClient } from './stripe-client'
import { v4 as uuidv4 } from 'uuid'

export interface MeterEventParams {
  eventName: string
  customerId: string
  value?: string | number
  timestamp?: number
  identifier?: string
  metadata?: Record<string, string>
}

export interface MeterEventResult {
  success: boolean
  event?: {
    id: string
    event_name: string
    identifier: string
    payload: {
      stripe_customer_id: string
      value: string
    }
    timestamp: number
  }
  error?: string
  details?: string
}

/**
 * Logs a meter event to Stripe for usage-based billing
 * 
 * @param params - The meter event parameters
 * @returns Promise<MeterEventResult> - The result of logging the event
 * 
 * @example
 * // Log API usage
 * await logMeterEvent({
 *   eventName: 'api_request',
 *   customerId: 'cus_customer123',
 *   value: 100, // Number of API calls
 *   metadata: { endpoint: '/api/users' }
 * })
 * 
 * @example  
 * // Log token consumption
 * await logMeterEvent({
 *   eventName: 'tokens_consumed',
 *   customerId: 'cus_customer123', 
 *   value: 1500,
 *   metadata: { model: 'gpt-4', request_id: 'req_123' }
 * })
 */
export const logMeterEvent = async (params: MeterEventParams): Promise<MeterEventResult> => {
  try {
    const {
      eventName,
      customerId,
      value = 1,
      timestamp,
      identifier,
      metadata
    } = params

    // Validate required parameters
    if (!eventName) {
      return {
        success: false,
        error: 'Event name is required'
      }
    }

    if (!customerId) {
      return {
        success: false,
        error: 'Customer ID is required'
      }
    }

    // Validate customer ID format
    if (!customerId.startsWith('cus_')) {
      return {
        success: false,
        error: 'Customer ID must be a valid Stripe customer ID (starts with cus_)'
      }
    }

    const stripe = getStripeClient()

    // Verify customer exists
    try {
      await stripe.customers.retrieve(customerId)
    } catch (error) {
      return {
        success: false,
        error: `Invalid customer ID: ${customerId}`,
        details: error instanceof Error ? error.message : 'Customer not found'
      }
    }

    // Prepare the meter event payload
    const eventPayload: {
      stripe_customer_id: string
      value: string
      [key: string]: string
    } = {
      stripe_customer_id: customerId,
      value: String(value)
    }

    // Add metadata to payload if provided
    if (metadata) {
      Object.entries(metadata).forEach(([key, val]) => {
        eventPayload[key] = String(val)
      })
    }

    // Create the meter event
    const meterEventParams = {
      event_name: eventName,
      payload: eventPayload,
      identifier: identifier || uuidv4(), // Use provided identifier or generate UUID
      ...(timestamp ? { timestamp } : {}) // Only include timestamp if provided
    }

    const meterEvent = await stripe.billing.meterEvents.create(meterEventParams)

    return {
      success: true,
      event: {
        id: meterEvent.identifier,
        event_name: meterEvent.event_name,
        identifier: meterEvent.identifier,
        payload: meterEvent.payload as {
          stripe_customer_id: string
          value: string
        },
        timestamp: meterEvent.timestamp
      }
    }
  } catch (error) {
    console.error('Error logging meter event:', error)
    
    // Handle Stripe-specific errors
    if (error && typeof error === 'object' && 'type' in error) {
      const stripeError = error as { type: string; message: string; code?: string }
      return {
        success: false,
        error: `Stripe error: ${stripeError.message}`,
        details: stripeError.code || stripeError.type
      }
    }
    
    return {
      success: false,
      error: 'Failed to log meter event',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Batch log multiple meter events
 * 
 * @param events - Array of meter event parameters
 * @returns Promise<MeterEventResult[]> - Array of results for each event
 * 
 * @example
 * await batchLogMeterEvents([
 *   {
 *     eventName: 'api_request',
 *     customerId: 'cus_customer123',
 *     value: 50,
 *     metadata: { endpoint: '/api/users' }
 *   },
 *   {
 *     eventName: 'api_request', 
 *     customerId: 'cus_customer123',
 *     value: 25,
 *     metadata: { endpoint: '/api/orders' }
 *   }
 * ])
 */
export const batchLogMeterEvents = async (
  events: MeterEventParams[]
): Promise<MeterEventResult[]> => {
  const results = await Promise.allSettled(
    events.map(event => logMeterEvent(event))
  )

  return results.map(result => {
    if (result.status === 'fulfilled') {
      return result.value
    } else {
      return {
        success: false,
        error: 'Failed to log meter event',
        details: result.reason instanceof Error ? result.reason.message : 'Unknown error'
      }
    }
  })
}

/**
 * Helper to log common usage events
 */
export const logApiUsage = async (
  customerId: string,
  requestCount: number = 1,
  metadata?: { endpoint?: string; method?: string; [key: string]: string | undefined }
): Promise<MeterEventResult> => {
  return logMeterEvent({
    eventName: 'api_request',
    customerId,
    value: requestCount,
    metadata: metadata as Record<string, string>
  })
}

export const logTokenUsage = async (
  customerId: string,
  tokenCount: number,
  metadata?: { model?: string; request_id?: string; [key: string]: string | undefined }
): Promise<MeterEventResult> => {
  return logMeterEvent({
    eventName: 'tokens_consumed',
    customerId,
    value: tokenCount,
    metadata: metadata as Record<string, string>
  })
}

export const logStorageUsage = async (
  customerId: string,
  bytesUsed: number,
  metadata?: { storage_type?: string; [key: string]: string | undefined }
): Promise<MeterEventResult> => {
  return logMeterEvent({
    eventName: 'storage_used',
    customerId,
    value: bytesUsed,
    metadata: metadata as Record<string, string>
  })
}