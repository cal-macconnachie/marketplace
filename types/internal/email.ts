/**
 * Email service types
 * @internal Backend only
 */

export interface EmailRecipient {
  email: string
  name?: string
}

export interface EmailTemplateData {
  [key: string]: string | number | boolean | undefined
}

export interface SendEmailParams {
  to: string
  from?: string
  reply_to?: string
  cc?: string[]
  bcc?: string[]
  subject: string
  templateName?: string
  templateData?: EmailTemplateData
  body?: string // optional pre-rendered body (HTML)
}

export interface EmailReceiptLineItem {
  description: string
  quantity: number
  amount: number
  currency: string
}

export interface ReceiptData {
  recipientEmail: string
  recipientName: string
  orderNumber: string
  orderDate: string
  lineItems: EmailReceiptLineItem[]
  subtotal: number
  tax: number
  total: number
  currency: string
  paymentMethod: string
}

/**
 * Receipt summary data for email generation
 */
export interface EmailReceiptSummary {
  subtotal: number
  subtotal_formatted: string
  total_formatted: string
  tax: number
  total: number
  currency: string
}

/**
 * Complete context for receipt email template
 */
export interface InternalReceiptEmailContext {
  recipientEmail: string
  recipientName: string
  orderNumber: string
  orderDate: string
  lineItems: EmailReceiptLineItem[]
  summary: EmailReceiptSummary
  paymentMethod: string
}
