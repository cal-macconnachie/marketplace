import type { Organization } from './organization'

/**
 * Shipping address structure
 */
export interface ShippingAddress {
  address_line1: string
  address_line2?: string
  city: string
  state: string
  postal_code: string
  country: string
}

/**
 * Data required to generate a shipping label
 */
export interface ShippingLabelData {
  orderId: string
  customerName: string
  customerEmail?: string
  customerPhone?: string
  shippingAddress: ShippingAddress
  returnOrganization?: Organization
}
