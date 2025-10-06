/**
 * Organization entity representing a business or group in the system
 */
export interface Organization {
  id: string
  name?: string
  phone?: string
  email?: string
  currency?: string
  address?: {
    line_1: string
    line_2?: string
    state: string
    city: string
    country: string
    postal_code: string
  }
  created_at: string
  updated_at?: string

  // Stripe fields
  /** Map of account_id -> subscription_id */
  stripe_subscription_ids?: { [accountId: string]: string }
  default_payment_method?: {
    user_id: string
    id: string
  }

  // Auth fields
  in_good_standing_until?: number

  /** Connected account ID */
  stripe_account_id?: string
  /** Bank account ID */
  stripe_bank_account_id?: string

  // Seller onboarding state
  /** URL for onboarding */
  onboarding_url?: string
  onboarding_status?: 'not_started' | 'in_progress' | 'completed' | 'requires_action'
  /** ISO timestamp when onboarding was completed */
  onboarding_completed_at?: string
  missing_requirements?: string[]
  /** Whether the account can accept charges */
  charges_enabled?: boolean
  /** Whether the account can receive payouts */
  payouts_enabled?: boolean

  // Tax configuration
  /** Whether Stripe Tax is enabled for this account */
  tax_enabled?: boolean
  tax_settings?: {
    /** Default tax code for products */
    tax_code: string
    /** Whether tax is added on top or included in price */
    tax_behavior: 'exclusive' | 'inclusive'
    /** Country where business is headquartered */
    head_office_country: string
  }
  /** Array of "country:registration_id" pairs */
  tax_registrations?: string[]

  // Platform fees
  platform_fee_percent?: number
  platform_fee_fixed?: number
  subscription_platform_fee_percent?: number

  // Company details (stored from Stripe)
  tax_id?: string
  business_type?: 'individual' | 'company' | 'non_profit' | 'government_entity'

  // Bank account details (stored for reference)
  bank_account?: {
    account_holder_name?: string
    account_holder_type?: 'individual' | 'company'
    last4?: string
    routing_number?: string
    bank_name?: string
    currency?: string
    country?: string
  }

  // Business profile
  business_profile?: {
    /** Merchant Category Code */
    mcc?: string
    url?: string
    product_description?: string
    support_phone?: string
    support_email?: string
    support_url?: string
  }

  // Individual representative details (if applicable)
  representative?: {
    first_name?: string
    last_name?: string
    email?: string
    phone?: string
    dob?: {
      day?: number
      month?: number
      year?: number
    }
    address?: {
      line_1?: string
      line_2?: string
      city?: string
      state?: string
      postal_code?: string
      country?: string
    }
    relationship?: {
      title?: string
      representative?: boolean
      executive?: boolean
      owner?: boolean
      percent_ownership?: number
    }
    ssn_last_4?: string
  }

  // Capabilities and requirements snapshot
  capabilities?: {
    card_payments?: 'active' | 'inactive' | 'pending'
    bank_transfers?: 'active' | 'inactive' | 'pending'
    transfers?: 'active' | 'inactive' | 'pending'
  }

  // Metadata for custom fields
  metadata?: Record<string, string>

  // Purchased products
  purchased_products?: import('./product').PurchasedProduct[]
}
