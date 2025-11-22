/**
 * Platform fee entity representing monthly maintenance fee collections
 * from connected Stripe accounts
 */
export interface PlatformFee {
  /** Unique identifier for the fee record */
  id: string
  /** Organization being charged the fee */
  organization_id: string
  /** Stripe connected account ID */
  stripe_account_id: string
  /** Stripe transfer ID if transfer was successful */
  stripe_transfer_id?: string
  /** Fee amount in cents (e.g., 300 = $3.00) */
  amount: number
  /** Currency code (e.g., 'usd', 'cad', 'eur') */
  currency: string
  /** Status of the fee collection attempt */
  status: 'success' | 'failed' | 'insufficient_funds' | 'pending'
  /** Error message if collection failed */
  error_message?: string
  /** Fee period in YYYY-MM format (e.g., '2025-01') */
  fee_period: string
  /** Timestamp when fee record was created */
  created_at: string
  /** Timestamp when fee record was last updated */
  updated_at?: string
}
