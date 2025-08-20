export interface PaymentMethod {
  user_id: string
  id: string
  last_four_digits: string
  brand: string
  expiry_month: number
  expiry_year: number
}