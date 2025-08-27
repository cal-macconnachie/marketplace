import {
  logMeterEvent, MeterEventResult 
} from './stripe/log-meter-event'
import { getUserByEmail } from './users/get-user-by-email'
import { getOrganizationById } from './organizations/get-organization-by-id'

export interface UsageTrackingParams {
  userEmail: string
  eventName: string
  value?: string | number
  metadata?: Record<string, string>
  organizationId?: string
}

export interface UsageTrackingResult extends MeterEventResult {
  customerId?: string
  organizationId?: string
}

/**
 * High-level usage tracking that resolves user/organization context
 * and logs meter events for billing
 * 
 * @param params - Usage tracking parameters
 * @returns Promise<UsageTrackingResult>
 * 
 * @example
 * // Track API usage for a user
 * await trackUsage({
 *   userEmail: 'user@example.com',
 *   eventName: 'api_request',
 *   value: 1,
 *   metadata: { 
 *     endpoint: '/api/generate',
 *     method: 'POST',
 *     response_time_ms: '234'
 *   }
 * })
 */
export const trackUsage = async (params: UsageTrackingParams): Promise<UsageTrackingResult> => {
  try {
    const {
      userEmail, eventName, value = 1, metadata, organizationId 
    } = params

    // Get user information
    const user = await getUserByEmail(userEmail)
    if (!user) {
      return {
        success: false,
        error: 'User not found'
      }
    }

    if (!user.stripe_id) {
      return {
        success: false,
        error: 'User does not have a Stripe customer ID'
      }
    }

    // Get organization if specified or use user's primary organization
    let targetOrgId = organizationId
    if (!targetOrgId && user.organization_id) {
      targetOrgId = user.organization_id
    }

    let organization = null
    if (targetOrgId) {
      organization = await getOrganizationById(targetOrgId)
    }

    // Enhance metadata with context
    const enhancedMetadata = {
      ...metadata,
      user_id: user.id,
      user_email: userEmail,
      ...(organization?.id && { organization_id: organization.id }),
      ...(organization?.name && { organization_name: organization.name }),
      tracked_at: new Date().toISOString()
    }

    // Log the meter event
    const result = await logMeterEvent({
      eventName,
      customerId: user.stripe_id,
      value,
      metadata: enhancedMetadata
    })

    return {
      ...result,
      customerId: user.stripe_id,
      organizationId: targetOrgId
    }
  } catch (error) {
    console.error('Error tracking usage:', error)
    return {
      success: false,
      error: 'Failed to track usage',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Middleware-style usage tracker for API endpoints
 * Returns a function that can be called to track usage after successful API calls
 * 
 * @param baseParams - Base parameters for usage tracking
 * @returns Function to call for tracking usage
 * 
 * @example
 * export const handler = async (event) => {
 *   const trackUsage = createUsageTracker({
 *     userEmail: event.requestContext.authorizer.claims.email,
 *     eventName: 'api_generate_text'
 *   })
 *   
 *   try {
 *     // Your API logic here
 *     const result = await generateText(prompt)
 *     
 *     // Track usage on success
 *     await trackUsage({
 *       value: result.tokenCount,
 *       metadata: {
 *         model: 'gpt-4',
 *         prompt_length: prompt.length.toString(),
 *         output_length: result.text.length.toString()
 *       }
 *     })
 *     
 *     return { statusCode: 200, body: JSON.stringify(result) }
 *   } catch (error) {
 *     // Don't track usage on errors
 *     return { statusCode: 500, body: JSON.stringify({ error: error.message }) }
 *   }
 * }
 */
export const createUsageTracker = (baseParams: Omit<UsageTrackingParams, 'value' | 'metadata'>) => {
  return async (params: Pick<UsageTrackingParams, 'value' | 'metadata'> = {}) => {
    return trackUsage({
      ...baseParams,
      ...params
    })
  }
}

/**
 * Common usage tracking patterns
 */
export const usagePatterns = {
  /**
   * Track API request usage
   */
  apiRequest: (userEmail: string, endpoint: string, method: string = 'GET') => 
    trackUsage({
      userEmail,
      eventName: 'api_request',
      value: 1,
      metadata: {
        endpoint, method 
      }
    }),

  /**
   * Track AI/ML token consumption
   */
  tokenConsumption: (
    userEmail: string, 
    tokens: number, 
    model: string,
    requestId?: string
  ) => 
    trackUsage({
      userEmail,
      eventName: 'tokens_consumed',
      value: tokens,
      metadata: { 
        model, 
        ...(requestId && { request_id: requestId })
      }
    }),

  /**
   * Track file processing
   */
  fileProcessing: (
    userEmail: string,
    fileSize: number,
    fileType: string,
    processingTime?: number
  ) => 
    trackUsage({
      userEmail,
      eventName: 'file_processed',
      value: fileSize,
      metadata: {
        file_type: fileType,
        ...(processingTime && { processing_time_ms: processingTime.toString() })
      }
    }),

  /**
   * Track data storage usage
   */
  dataStorage: (
    userEmail: string,
    bytesStored: number,
    storageType: string = 'general'
  ) =>
    trackUsage({
      userEmail,
      eventName: 'storage_used',
      value: bytesStored,
      metadata: { storage_type: storageType }
    }),

  /**
   * Track email sending
   */
  emailSent: (
    userEmail: string,
    emailCount: number = 1,
    emailType: string = 'transactional'
  ) =>
    trackUsage({
      userEmail,
      eventName: 'email_sent',
      value: emailCount,
      metadata: { email_type: emailType }
    })
}

/**
 * Async wrapper that tracks usage and handles errors gracefully
 * Won't throw errors if usage tracking fails, just logs them
 * 
 * @param trackingParams - Parameters for usage tracking
 * @param operation - The operation to perform and track
 * @returns The result of the operation
 * 
 * @example
 * const result = await trackUsageAsync(
 *   {
 *     userEmail: 'user@example.com',
 *     eventName: 'api_generate',
 *     value: 150,
 *     metadata: { model: 'gpt-4' }
 *   },
 *   async () => {
 *     return await generateText(prompt)
 *   }
 * )
 */
export const trackUsageAsync = async <T>(
  trackingParams: UsageTrackingParams,
  operation: () => Promise<T>
): Promise<T> => {
  try {
    const result = await operation()
    
    // Track usage after successful operation
    trackUsage(trackingParams).catch(error => {
      console.error('Failed to track usage (non-blocking):', error)
    })
    
    return result
  } catch (error) {
    // Don't track usage on failed operations
    throw error
  }
}