/**
 * Tax calculation types
 * @internal Backend only
 */

/**
 * Result from Stripe tax calculation (simple version from stripe-tax-calculation.ts)
 */
export interface TaxCalculationResult {
  tax_amount?: number
  tax_rate?: number
  items?: Array<{
    id: string
    group_id: string
    organization_id: string
    quantity: number
    amount: number
    tax_amount: number
    tax_rate: number
    currency: string
  }>
  total_amount?: number
  total_tax?: number
}

/**
 * Items interface for tax calculation
 */
export interface ItemsInterface {
  group_id: string
  id: string
  organization_id: string
  quantity: number
}

/**
 * Cached tax calculation entry
 */
export interface TaxCalculationCache {
  location: string
  tax_code: string
  tax_rate: number
  expires_at: number
  calculated_at: number
}

export interface AddressInput {
  country: string
  state: string
  city?: string
  postal_code?: string
}

export interface AddressCodes {
  country: string
  state: string
  city?: string
  postal_code?: string
}
