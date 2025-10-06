/**
 * Payment method entity representing a user's payment method (e.g., credit card)
 */
export interface PaymentMethod {
  user_id: string
  id: string
  last_four_digits: string
  brand: string
  expiry_month: number
  expiry_year: number
  archived?: boolean
  status?: 'pending_verification' | 'active' | 'failed'
}

/**
 * Purchase entity representing a completed or pending purchase transaction
 */
export interface Purchase {
  id: string
  user_id: string
  product_id: string
  product_group_id: string
  product_name: string
  type: 'one_time' | 'subscription' | 'metered_subscription'
  purchased_at: string
  organization_id: string
  payment_method_id: string
  amount: number
  /** @internal Original amount before any adjustments */
  original_amount?: number
  currency: string
  cart_id?: string
  platform_fee_amount?: number
  /** @internal Original platform fee before adjustments */
  original_platform_fee_amount?: number
  connected_account_id?: string
  destination_charge_id?: string
  transfer_id?: string
  tax_amount?: number
  /** @internal Original tax amount before adjustments */
  original_tax_amount?: number
  base_amount?: number
  /** @internal Original base amount before adjustments */
  original_base_amount?: number
  seller_organization_id?: string
  applied_discount?: {
    type: 'promotion_code' | 'coupon'
    code?: string
    coupon?: {
      id: string
      amount_off: number
      percent_off: number
    }
  }
  status: 'completed' | 'pending' | 'failed'
}
