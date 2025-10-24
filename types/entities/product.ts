/**
 * Product entity representing a sellable product in the marketplace
 */
export interface Product {
  group_id: string
  id: string
  organization_id: string
  name: string
  description: string
  active: boolean
  is_public: boolean
  quantity_limit?: number
  quantity?: number
  metadata?: Record<string, string>
  tax_code?: string
  images?: string[]
  default_price_data: {
    currency: string
    unit_amount: number
    recurring?: {
      interval: 'day' | 'week' | 'month' | 'year'
      interval_count?: number
      usage_type?: 'licensed' | 'metered'
    }
    /** Billing meter ID for usage-based pricing */
    meter?: string
    /** Event name for usage-based pricing */
    meter_event?: string
    /** Label for the unit of measure */
    unit_label?: string
    tax_behavior?: 'exclusive' | 'inclusive' | 'unspecified'
  }
  marketing_features?: {
    name: string
  }[]
  statement_descriptor?: string

  // Backend operational fields
  /** @internal Whether to persist changes to Stripe */
  persist_update: boolean
  /** @internal Optional, used for linking to a price if applicable */
  price_id?: string
  /** @internal Error message from Stripe operations */
  error?: string
  /** @internal ISO timestamp of last processing */
  last_processed_at?: string
  /** @internal Version number for price changes */
  price_version?: number

  /** ID of the Stripe account associated with the product */
  account_id: string
}

/**
 * Purchased product entity representing a user's purchase of a product
 */
export interface PurchasedProduct {
  id: string
  organization_id: string
  product_id: string
  group_id: string
  name: string
  metadata?: Record<string, string>
  user_id?: string
  in_good_standing_until?: number
  amount: number
  currency: string
  purchase_id: string
  subscription_id?: string
  subscription_item_id?: string
  /** @internal Whether the subscription has been cancelled */
  cancelled?: boolean
  created_at: string
  updated_at: string
}
