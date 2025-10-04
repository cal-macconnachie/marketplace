import { getStripeClient } from './stripe-client'
import { v4 as uuidv4 } from 'uuid'
import { get } from '../dynamo-helpers/get'
import { update } from '../dynamo-helpers/update'
import { Purchase } from '../../handlers/purchases'
import { Product } from '../../handlers/products'
import { User } from '../../handlers/users'
import { calculateTaxesWithCaching } from '../tax/calculate-taxes-with-caching'
import { generateLocationKey } from '../tax/tax-calculation-cache'
import { Organization } from '../../handlers/organizations'
import { calculatePlatformFee } from './calculate-platform-fee'

export interface MeterEventParams {
  purchaseId: string
  userId: string
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
      purchaseId,
      userId,
      value = 1,
      timestamp = Math.floor(Date.now() / 1000),
      identifier,
      metadata
    } = params

    // Validate required parameters
    if (!purchaseId) {
      return {
        success: false,
        error: 'Purchase ID is required'
      }
    }

    if (!userId) {
      return {
        success: false,
        error: 'User ID is required'
      }
    }

    // Get the purchase
    const purchase = await get<Purchase>({
      tableName: process.env.PURCHASES_TABLE!,
      key: {
        user_id: userId,
        id: purchaseId
      }
    })

    if (!purchase) {
      return {
        success: false,
        error: `Purchase not found: ${purchaseId}`
      }
    }

    if (purchase.type !== 'metered_subscription') {
      return {
        success: false,
        error: 'Purchase is not a metered subscription'
      }
    }

    if (purchase.status !== 'pending') {
      return {
        success: false,
        error: `Purchase status is ${purchase.status}, expected pending`
      }
    }

    // Get the product to find the event name
    const product = await get<Product>({
      tableName: process.env.PRODUCTS_TABLE!,
      key: {
        group_id: purchase.product_group_id,
        id: purchase.product_id
      }
    })

    if (!product) {
      return {
        success: false,
        error: `Product not found: ${purchase.product_id}`
      }
    }

    const eventName = product.default_price_data?.meter_event
    if (!eventName) {
      return {
        success: false,
        error: 'Product does not have a meter event configured'
      }
    }

    // Get the user to get the customer ID
    const user = await get<User>({
      tableName: process.env.USERS_TABLE!,
      key: {
        id: userId
      }
    })

    if (!user || !user.stripe_id) {
      return {
        success: false,
        error: 'User or Stripe customer ID not found'
      }
    }

    const stripe = getStripeClient()

    // Prepare the meter event payload
    const eventPayload: {
      stripe_customer_id: string
      value: string
      [key: string]: string
    } = {
      stripe_customer_id: user.stripe_id,
      value: String(value)
    }

    // Add metadata to payload if provided
    if (metadata) {
      Object.entries(metadata).forEach(([
        key,
        val
      ]) => {
        eventPayload[key] = String(val)
      })
    }

    // Create the meter event
    const meterEventParams = {
      event_name: eventName,
      payload: eventPayload,
      identifier: identifier ?? uuidv4(), // Use provided identifier or generate UUID
      ...(timestamp ? { timestamp } : {}) // Only include timestamp if provided
    }

    const meterEvent = await stripe.billing.meterEvents.create(meterEventParams)

    // Update purchase and purchased product amounts
    try {
      // Calculate new amount (add the value from this meter event)
      const currentAmount = purchase.base_amount ?? 0
      const additionalAmount = Number(value) * (product.default_price_data?.unit_amount ?? 1)
      const newBaseAmount = currentAmount + additionalAmount
      const productsHash = {[`${product.group_id}:${product.id}`]: product }
      const orgsHash: { [key: string]: Organization } = {}
      const org = await get<Organization>({
        tableName: process.env.ORGANIZATIONS_TABLE!,
        key: { id: product.organization_id }
      })
      if (!org) {
        throw new Error(`Organization not found: ${product.organization_id}`)
      }
      orgsHash[product.organization_id] = org
      const items = [
        {
          id: product.id,
          group_id: product.group_id,
          organization_id: product.organization_id,
          quantity: 1,
          amount: newBaseAmount,
          tax_code: product.tax_code || 'txcd_99999999' // Default tax code if none set
        }
      ]
      const location = generateLocationKey(user)

      const taxAmount = await calculateTaxesWithCaching(items, productsHash, orgsHash, location)
      const newAmount = newBaseAmount + taxAmount.items[0]?.tax_amount || 0
      const platformFee = await calculatePlatformFee({
        amount: newAmount,
        organizationId: product.organization_id
      })

      // Update purchase amount
      await update<Purchase>({
        tableName: process.env.PURCHASES_TABLE!,
        key: {
          user_id: purchase.user_id,
          id: purchase.id
        },
        updates: {
          amount: newAmount,
          base_amount: newBaseAmount,
          tax_amount: taxAmount.items[0]?.tax_amount || 0,
          platform_fee_amount: platformFee
        }
      })

      console.log(`Updated purchase ${purchase.id} amount to ${newAmount} with meter event value ${value}`)
    } catch (error) {
      console.error('Error updating purchase amount from meter event:', error)
      // Don't fail the meter event logging if amount updates fail
    }

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
  purchaseId: string,
  userId: string,
  requestCount: number = 1,
  metadata?: { endpoint?: string; method?: string; [key: string]: string | undefined }
): Promise<MeterEventResult> => {
  return logMeterEvent({
    purchaseId,
    userId,
    value: requestCount,
    metadata: metadata as Record<string, string>
  })
}

export const logTokenUsage = async (
  purchaseId: string,
  userId: string,
  tokenCount: number,
  metadata?: { model?: string; request_id?: string; [key: string]: string | undefined }
): Promise<MeterEventResult> => {
  return logMeterEvent({
    purchaseId,
    userId,
    value: tokenCount,
    metadata: metadata as Record<string, string>
  })
}

export const logStorageUsage = async (
  purchaseId: string,
  userId: string,
  bytesUsed: number,
  metadata?: { storage_type?: string; [key: string]: string | undefined }
): Promise<MeterEventResult> => {
  return logMeterEvent({
    purchaseId,
    userId,
    value: bytesUsed,
    metadata: metadata as Record<string, string>
  })
}