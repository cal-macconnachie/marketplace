/**
 * Form validation utilities and types
 * Used by frontend for client-side form validation
 */

export interface ValidationRule {
  message: string
  validator: (value: string) => boolean
}

export interface FieldValidation {
  rules: ValidationRule[]
  touched: boolean
  error: string | null
}

export interface FormValidation {
  [key: string]: FieldValidation
}
