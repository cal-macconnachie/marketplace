/**
 * Dispute entity representing a dispute raised by a buyer for one or more purchases
 */
export interface Dispute {
  id: string
  cart_id: string
  purchase_ids: string[] // Multiple purchases can be disputed together
  buyer_user_id: string
  buyer_organization_id: string
  seller_organization_id: string

  reason: string // Buyer's explanation
  status: 'pending' | 'accepted' | 'rejected' | 'escalated' | 'resolved'

  // Amounts
  total_dispute_amount: number
  currency: string

  // Seller response
  seller_response?: string
  seller_responded_at?: string

  // Platform resolution
  platform_notes?: string
  platform_resolved_at?: string
  platform_resolved_by?: string

  // Refund tracking
  refund_ids?: string[] // Stripe refund IDs
  refunded_at?: string

  // Metadata
  created_at: string
  updated_at: string
}

/**
 * Request to create a new dispute
 */
export interface DisputeCreateRequest {
  cart_id: string
  purchase_ids: string[]
  reason: string
}

/**
 * Request for seller to respond to a dispute
 */
export interface DisputeRespondRequest {
  dispute_id: string
  action: 'accept' | 'reject'
  response: string
}

/**
 * Request for platform manager to resolve an escalated dispute
 */
export interface DisputePlatformResolveRequest {
  dispute_id: string
  action: 'accept' | 'reject'
  notes: string
}

/**
 * Query parameters for getting disputes
 */
export interface DisputeQueryParams {
  view: 'buyer' | 'seller' | 'platform'
  status?: Dispute['status']
  limit?: number
  lastKey?: string
}

/**
 * Response for dispute queries with pagination
 */
export interface DisputeQueryResponse {
  items: Dispute[]
  lastKey?: string
}
