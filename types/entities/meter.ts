/**
 * Billing meter entity for tracking usage-based billing
 */
export interface BillingMeter {
  id?: string
  display_name: string
  event_name: string
  default_aggregation: {
    formula: 'sum' | 'count' | 'last'
  }
  status?: 'active' | 'inactive'
  created?: number
  updated?: number
  account_id?: string
}
