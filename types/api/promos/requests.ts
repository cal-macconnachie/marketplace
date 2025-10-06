/**
 * Request to create a coupon
 * @internal Backend only
 */
export interface CreateCouponRequest {
  name: string
  id?: string
  percent_off?: number
  amount_off?: number
  currency?: string
  duration: 'once' | 'repeating' | 'forever'
  duration_in_months?: number
  max_redemptions?: number
  redeem_by?: number
  applies_to?: {
    products?: string[]
  }
  account_id: string
}

/**
 * Request to create a promotion code
 * @internal Backend only
 */
export interface CreatePromotionCodeRequest {
  coupon: string
  code?: string
  customer?: string
  expires_at?: number
  max_redemptions?: number
  restrictions?: {
    first_time_transaction?: boolean
    minimum_amount?: number
    minimum_amount_currency?: string
  }
  account_id: string
}

/**
 * Request to create a promo (coupon with optional promotion code)
 * @internal Backend only
 */
export interface CreatePromoRequest extends CreateCouponRequest {
  code?: string
  customer?: string
  expires_at?: number
  promo_max_redemptions?: number
  restrictions?: {
    first_time_transaction?: boolean
    minimum_amount?: number
    minimum_amount_currency?: string
  }
}

/**
 * Request to update a coupon
 * @internal Backend only
 */
export interface UpdateCouponRequest {
  id: string
  name?: string
  metadata?: Record<string, string>
}

/**
 * Request to update a promotion code
 * @internal Backend only
 */
export interface UpdatePromotionCodeRequest {
  id: string
  active?: boolean
  metadata?: Record<string, string>
}

/**
 * Request to list coupons
 * @internal Backend only
 */
export interface ListCouponsRequest {
  limit?: number
  starting_after?: string
  ending_before?: string
  created?: number | { gt?: number; gte?: number; lt?: number; lte?: number }
  account_id?: string
}

/**
 * Request to list promotion codes
 * @internal Backend only
 */
export interface ListPromotionCodesRequest {
  coupon?: string
  customer?: string
  code?: string
  limit?: number
  starting_after?: string
  ending_before?: string
  created?: number | { gt?: number; gte?: number; lt?: number; lte?: number }
  active?: boolean
  account_id?: string
}

/**
 * Request to delete a coupon
 * @internal Backend only
 */
export interface DeleteCouponRequest {
  id: string
}

/**
 * Request to delete a promotion code
 * @internal Backend only
 */
export interface DeletePromotionCodeRequest {
  id: string
}
