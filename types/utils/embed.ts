/**
 * Embed script types and utilities
 * Used for iframe embedding and cross-domain cart management
 */

/// <reference lib="dom" />

import type { CartItem } from './cart'

/**
 * Message data structure for postMessage communication between iframe and parent
 */
export interface MessageData {
  type: string
  data?: {
    [key: string]: unknown
  }
  source?: string
  height?: string
}

/**
 * Cart update message payload
 */
export interface CartUpdateMessage {
  groupId: string
  productId: string
  organizationId: string
  quantity: number
  action: 'add' | 'remove'
}

/**
 * Initial cart data response
 */
export interface InitialCartDataMessage {
  type: 'initial-cart-data'
  cart: {
    [key: string]: CartItem
  }
}

/**
 * Resize message
 */
export interface ResizeMessage {
  type: 'resize'
  source: string
  height: string
}

/**
 * Cart link response message
 */
export interface CartLinkResponseMessage {
  type: 'cart-link-response'
  cartLink: string
}

/**
 * Global window extensions for embed functionality
 */
declare global {
  interface Window {
    generateCheckoutUrl?: (
      checkoutDomain: string,
      additionalParams?: Record<string, string>,
    ) => string | null
  }

  interface WindowEventMap {
    'cart-updated': CustomEvent<{ cart: { [key: string]: CartItem } }>
  }
}
