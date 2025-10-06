/**
 * EventBridge event types
 * @internal Backend only
 */

export interface EventBridgeEvent<T = any> {
  'detail-type': string
  source: string
  detail: T
  time?: string
  region?: string
  account?: string
}

export interface ProductsPurchasedEventDetail {
  userId: string
  organizationId: string
  cartId: string
  purchases: Array<{
    productId: string
    quantity: number
    amount: number
  }>
  total: number
  currency: string
}

export interface PendingPurchasesAddedEventDetail {
  cartId: string
  userId: string
  organizationId: string
  purchases: Array<{
    id: string
    productId: string
    status: string
  }>
}
