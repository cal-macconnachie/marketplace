
export interface ReceiptLineItem {
  product_id: string
  product_name: string
  product_description?: string
  quantity: number
  unit_price_formatted: string
  subtotal_formatted: string
  is_subscription?: boolean
  interval_text?: string
  seller_id?: string
  seller_name?: string
  purchase_id?: string
}

export interface ReceiptSummary {
  subtotal_formatted: string
  discounts_formatted?: string
  fees_formatted?: string
  tax_formatted?: string
  total_formatted: string
}

export interface ReceiptEmailContext {
  preheader: string
  receipt_number: string
  purchase_datetime: string
  currency: string
  header_brand?: string
  footer_brand?: string
  is_multi_seller?: boolean

  organization_name?: string // kept for backward compatibility when single seller
  organization_email?: string // kept for backward compatibility when single seller
  organization_logo_url?: string
  organization_address_line_1?: string
  organization_address_line_2?: string
  organization_city?: string
  organization_state?: string
  organization_postal_code?: string
  organization_country?: string
  support_url?: string

  customer_name: string
  customer_email: string
  customer_phone?: string

  payment_method_brand?: string
  payment_method_last4?: string
  payment_method_expiry_month?: number
  payment_method_expiry_year?: number

  line_items: ReceiptLineItem[]
  summary: ReceiptSummary
  notes?: string
  sellers?: Array<{
    id: string
    name?: string
    email?: string
    address_line_1?: string
    address_line_2?: string
    city?: string
    state?: string
    postal_code?: string
    country?: string
  }>
  seller_groups?: Array<{
    seller_id: string
    seller_name?: string
    seller_email?: string
    seller_phone?: string
    address_line_1?: string
    address_line_2?: string
    city?: string
    state?: string
    postal_code?: string
    country?: string
    items: ReceiptLineItem[]
    subtotal_formatted: string
    tax_formatted?: string
    fees_formatted?: string
    total_formatted: string
    support_url?: string
    statement_descriptor?: string
  }>
  receipt_url: string
  customer_ip_address?: string
}