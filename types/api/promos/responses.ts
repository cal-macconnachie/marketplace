import type { Promo } from '../../entities/promo'

/**
 * Response from creating a coupon
 * @internal Backend only
 */
export interface CreateCouponResponse {
  coupon: {
    id: string
  }
  message: string
}

/**
 * Response from creating a promotion code
 * @internal Backend only
 */
export interface CreatePromotionCodeResponse {
  id: string
  message: string
}

/**
 * Response from creating a promo (coupon with optional promotion code)
 * @internal Backend only
 */
export interface CreatePromoResponse {
  coupon: {
    id: string
  }
  promotionCode?: {
    id: string
  }
  message: string
}

/**
 * Response from listing coupons or promotion codes
 * @internal Backend only
 */
export interface ListPromosResponse {
  success: boolean
  data: {
    object: 'list'
    data: Promo[]
    has_more: boolean
    total_count: number
    url: string
  }
}

/**
 * Response from deleting a coupon or promotion code
 * @internal Backend only
 */
export interface DeletePromoResponse {
  id: string
  message: string
}
