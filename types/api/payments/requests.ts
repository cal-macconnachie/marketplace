import type { Purchase, PaymentMethod } from '../../entities/payment'
import type { PurchasedProduct } from '../../entities/product'

/**
 * Request to create a new payment method
 */
export interface CreatePaymentMethodRequest {
  user_id: string
  id: string
  last_four_digits: string
  brand: string
  expiry_month: number
  expiry_year: number
}

/**
 * Request to get payment methods for a user
 */
export interface GetPaymentMethodsRequest {
  user_id: string
}

/**
 * Request to archive a payment method
 */
export interface ArchivePaymentMethodRequest {
  user_id: string
  id: string
}

/**
 * Request to purchase products
 */
export interface PurchaseProductsRequest {
  userId: string
  paymentMethodId: string
  productKeys: Array<{
    id: string
    group_id: string
  }>
  promoCode?: string
  couponId?: string
}

/**
 * Request to get purchases with pagination
 */
export interface GetPurchasesRequest {
  purchase: Partial<Purchase>
  lastEvaluatedKey?: Record<string, unknown>
  type?: 'read' | 'update'
  limit?: number
}

/**
 * Request to get purchased products
 */
export interface GetPurchasedProductsRequest {
  organization_id?: string
  user_id?: string
  id?: string
  subscription_id?: string
  limit?: number
  last_evaluated_key?: Record<string, unknown>
  sort_order?: 'asc' | 'desc'
}

/**
 * Request to cancel a subscription
 */
export interface CancelSubscriptionRequest {
  subscription_ids: Record<string, string>
  user_id: string
}

/**
 * Request to cancel a subscription item
 */
export interface CancelSubscriptionItemRequest {
  user_id: string
  subscription_id: string
  purchased_product?: PurchasedProduct
}

/**
 * Request for guest checkout
 */
export interface GuestCheckoutRequest {
  user: {
    given_name: string
    family_name: string
    email: string
    address?: {
      line_1: string
      line_2?: string
      state: string
      city: string
      country: string
      postal_code: string
    }
    ip_address?: string
  }
  paymentMethodCreateParams: {
    id: string
    last_four_digits: string
    brand: string
    expiry_month: string
    expiry_year: string
  }
  productKeys: Array<{
    id: string
    group_id: string
  }>
  promoCode?: string
  couponId?: string
}

export interface AdjustPurchaseAmountParams {
  purchase: Purchase
  correctAmount: number
}
