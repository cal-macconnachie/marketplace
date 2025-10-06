/**
 * Response from creating a connected account
 */
export interface CreateConnectedAccountResponse {
  account_id: string
  requires_onboarding: boolean
  onboarding_url: string
  missing_requirements: string[]
  charges_enabled: boolean
  payouts_enabled: boolean
  details_submitted: boolean
}

/**
 * Response from refreshing Stripe account URL
 */
export interface RefreshStripeAccountResponse {
  url: string
}

/**
 * Response from creating an Express dashboard login link
 */
export interface CreateExpressLoginLinkResponse {
  login_url: string
}
