import type Stripe from 'stripe'

/**
 * Promo entity representing coupons and promotion codes
 */
export interface Promo {
  type: 'coupon' | 'promotion_code'
  id: string
  /** @internal Whether to persist changes to Stripe */
  persist_update?: boolean

  // Common fields
  metadata?: Record<string, string>
  created?: number
  livemode?: boolean

  // Coupon-specific fields
  name?: string
  percent_off?: number | null
  amount_off?: number | null
  currency?: string | null
  duration?: 'once' | 'repeating' | 'forever'
  duration_in_months?: number | null
  max_redemptions?: number | null
  redeem_by?: number | null
  times_redeemed?: number
  valid?: boolean
  applies_to?: {
    products?: string[]
  }
  /** Stripe ID for the coupon if applicable */
  stripeId?: string

  // Promotion code-specific fields
  code?: string
  coupon?: string | Stripe.Coupon
  customer?: string | null
  expires_at?: number | null
  active?: boolean
  restrictions?: {
    first_time_transaction?: boolean
    minimum_amount?: number | null
    minimum_amount_currency?: string | null
  }

  // System fields
  /** @internal Error message from Stripe operations */
  error?: string
  /** @internal ISO timestamp of last processing */
  last_processed_at?: string
  /** @internal Stripe account ID */
  account_id?: string
}
