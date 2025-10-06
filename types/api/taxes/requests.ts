/**
 * Item for tax calculation
 */
export interface TaxCalculationItem {
  id: string
  group_id: string
  organization_id: string
  quantity: number
}

/**
 * Request to calculate taxes for items
 */
export interface TaxCalculationRequest {
  items: TaxCalculationItem[]
  userId?: string
  ipAddress?: string
}
