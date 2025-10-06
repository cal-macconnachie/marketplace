/**
 * Stripe helper function types
 * @internal Backend only
 */

import type { Promo } from '../entities/promo'

/**
 * Parameters for logging a meter event
 */
export interface MeterEventParams {
  customerId: string
  purchaseId?: string
  userId?: string
  value: string | number
  timestamp?: number
  identifier?: string
  metadata?: Record<string, string>
}

/**
 * Result from logging a meter event
 */
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
  }
  error?: string
  details?: string
}

/**
 * Parameters for usage tracking
 */
export interface UsageTrackingParams {
  userEmail: string
  eventName: string
  value?: string | number
  metadata?: Record<string, string>
  organizationId?: string
}

/**
 * Result from usage tracking
 */
export interface UsageTrackingResult extends MeterEventResult {
  customerId?: string
  organizationId?: string
}

/**
 * Parameters for creating Stripe Express login link
 */
export interface CreateLoginLinkParams {
  connectedAccountId: string
}

/**
 * Result from promo code lookup
 */
export interface PromoLookupResult {
  id: string
  type: 'coupon' | 'promotion_code'
  code?: string
  active?: boolean
  stripeId?: string
}
