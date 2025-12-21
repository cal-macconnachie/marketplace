import type { PurchasedProduct } from './product'

/**
 * User entity representing a user in the system
 */
export interface User {
  // Basic fields
  id: string
  organization_id: string
  is_organization_admin: boolean
  is_super_admin?: boolean
  given_name?: string
  family_name?: string
  /** Full name, can be a combination of given_name and family_name */
  name?: string
  cognito_id?: string
  email?: string
  phone_number?: string
  social_provider?: string
  address?: {
    line_1: string
    line_2?: string
    state: string
    city: string
    country: string
    postal_code: string
  }
  ip_address?: string

  // Stripe fields
  stripe_id?: string
  stripe_customer_error?: string

  // Purchases
  products?: PurchasedProduct[]
  /** Timestamp until which the user is in good standing */
  in_good_standing_until?: number
  product_groups?: string[]

  // Admin
  is_internal_admin?: boolean
  notifications?: {
    email: boolean
    sms: boolean
  }
  notification_opt_out?: {
    [key: string]: boolean
  }
}
