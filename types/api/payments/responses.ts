import type { Purchase } from '../../entities/payment'

/**
 * Response from creating a payment method
 */
export interface CreatePaymentMethodResponse {
  id: string
  last_four_digits: string
  brand: string
  expiry_month: number
  expiry_year: number
  requires_action?: boolean
  next_action?: {
    type: string
    use_stripe_sdk?: {
      type: string
      stripe_js: string
    }
    redirect_to_url?: {
      url: string
      return_url: string
    }
  }
  setup_intent_client_secret?: string
}

/**
 * Response from getting purchases with pagination
 */
export interface GetPurchasesResponse {
  items: Purchase[]
  lastEvaluatedKey?: Record<string, unknown>
}
