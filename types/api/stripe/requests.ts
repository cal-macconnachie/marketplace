/**
 * Request to create a Stripe connected account
 */
export 
interface CreateConnectedAccountRequest {
  companyDetails: {
    name: string
    address: {
      line1: string
      line2: string
      city: string
      state: string
      postal_code: string
      country: string
    }
    phone: string
    tax_id: string
  }
  individual?: {
    phone?: string
    dob?: {
      day: string
      month: string
      year: string
    }
    relationship?: {
      title?: string
    }
  }
  bankDetails: {
    account_number: string
    country?: string
    currency?: string
    routing_number: string
    account_holder_name?: string
    account_holder_type?: 'individual' | 'company'
  }
  businessProfile?: {
    mcc?: string
    url?: string
    product_description?: string
  }
  refreshUrl: string
  returnUrl: string
}

/**
 * Request to refresh Stripe Connect onboarding URL
 */
export interface RefreshStripeAccountRequest {
  organization_id: string
  refresh_url: string
  return_url: string
}

/**
 * Request to log a meter event for usage-based billing
 */
export interface LogMeterEventRequest {
  purchase_id: string
  user_id: string
  value: number
  metadata?: Record<string, unknown>
}
