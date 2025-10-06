/**
 * Shopping cart types and utilities
 * Used by frontend for cart management
 */

export interface CartItem {
  groupId: string
  productId: string
  quantity: number
  organizationId: string
}

/**
 * Browser-side cart stored in localStorage
 * Key format: `${groupId}_${productId}`
 */
export interface BrowserCart {
  [key: string]: CartItem
}


/**
 * Cart entity for tracking multi-purchase transactions
 */
export interface Cart {
  user_id: string
  id: string
  purchases: { [purchaseId: string]: 'pending' | 'completed' | 'failed' }
  payment_method_id: string
  created_at: string
}

export interface SerializedCartData {
  items: CartItem[]
  timestamp: number
  domain: string
}

export interface CheckoutData {
  items: CartItem[]
  timestamp: number
  domain: string
}
