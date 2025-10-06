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

export const validationRules = {
  required: (message = 'This field is required'): ValidationRule => ({
    message,
    validator: (value: string) => value.trim().length > 0,
  }),

  email: (message = 'Please enter a valid email address'): ValidationRule => ({
    message,
    validator: (value: string) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return emailRegex.test(value.trim())
    },
  }),

  minLength: (length: number, message?: string): ValidationRule => ({
    message: message || `Must be at least ${length} characters long`,
    validator: (value: string) => value.trim().length >= length,
  }),

  maxLength: (length: number, message?: string): ValidationRule => ({
    message: message || `Must be no more than ${length} characters long`,
    validator: (value: string) => value.trim().length <= length,
  }),

  pattern: (regex: RegExp, message: string): ValidationRule => ({
    message,
    validator: (value: string) => regex.test(value),
  }),

  strongPassword: (
    message = 'Password must contain at least 8 characters with uppercase, lowercase, number, and special character',
  ): ValidationRule => ({
    message,
    validator: (value: string) => {
      const hasUpper = /[A-Z]/.test(value)
      const hasLower = /[a-z]/.test(value)
      const hasNumber = /\d/.test(value)
      const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(value)
      const hasMinLength = value.length >= 8

      return hasUpper && hasLower && hasNumber && hasSpecial && hasMinLength
    },
  }),

  confirmPassword: (
    originalPassword: string,
    message = 'Passwords do not match',
  ): ValidationRule => ({
    message,
    validator: (value: string) => value === originalPassword,
  }),

  name: (message = 'Please enter a valid name'): ValidationRule => ({
    message,
    validator: (value: string) => {
      const nameRegex = /^[a-zA-Z\s'-]{2,50}$/
      return nameRegex.test(value.trim())
    },
  }),
}

export const validateField = (value: string, rules: ValidationRule[]): string | null => {
  for (const rule of rules) {
    if (!rule.validator(value)) {
      return rule.message
    }
  }
  return null
}

export const validateForm = (
  formData: Record<string, string>,
  validationConfig: Record<string, ValidationRule[]>,
): FormValidation => {
  const validation: FormValidation = {}

  for (const [fieldName, rules] of Object.entries(validationConfig)) {
    const value = formData[fieldName] || ''
    const error = validateField(value, rules)

    validation[fieldName] = {
      rules,
      touched: true,
      error,
    }
  }

  return validation
}

export const getFormErrors = (validation: FormValidation): string[] => {
  return Object.values(validation)
    .map((field) => field.error)
    .filter((error): error is string => error !== null)
}

export const isFormValid = (validation: FormValidation): boolean => {
  return getFormErrors(validation).length === 0
}

// Composable for reactive form validation
import { ref, reactive, computed } from 'vue'

export const useFormValidation = (initialData: Record<string, string> = {}) => {
  const formData = reactive({ ...initialData })
  const validation = ref<FormValidation>({})
  const isSubmitting = ref(false)

  const errors = computed(() => getFormErrors(validation.value))
  const isValid = computed(() => isFormValid(validation.value))
  const hasErrors = computed(() => errors.value.length > 0)

  const setFieldValidation = (fieldName: string, rules: ValidationRule[]) => {
    if (!validation.value[fieldName]) {
      validation.value[fieldName] = {
        rules,
        touched: false,
        error: null,
      }
    } else {
      validation.value[fieldName].rules = rules
    }
  }

  const removeFieldValidation = (fieldName: string) => {
    if (validation.value[fieldName]) {
      delete validation.value[fieldName]
    }
  }

  const validateFieldByName = (fieldName: string): string | null => {
    const field = validation.value[fieldName]
    if (!field) return null

    const value = formData[fieldName] || ''
    const error = validateField(value, field.rules)

    validation.value[fieldName] = {
      ...field,
      touched: true,
      error,
    }

    return error
  }

  const validateAllFields = (): boolean => {
    let formIsValid = true

    for (const fieldName of Object.keys(validation.value)) {
      const error = validateFieldByName(fieldName)
      if (error) {
        formIsValid = false
      }
    }

    return formIsValid
  }

  const clearValidation = () => {
    for (const fieldName of Object.keys(validation.value)) {
      validation.value[fieldName].touched = false
      validation.value[fieldName].error = null
    }
  }

  const resetForm = (newData: Record<string, string> = {}) => {
    Object.keys(formData).forEach((key) => {
      formData[key] = newData[key] || ''
    })
    clearValidation()
  }

  const getFieldError = (fieldName: string): string | null => {
    const field = validation.value[fieldName]
    return field?.touched ? field.error : null
  }

  return {
    formData,
    validation: validation.value,
    errors,
    isValid,
    hasErrors,
    isSubmitting,
    setFieldValidation,
    removeFieldValidation,
    validateField,
    validateAllFields,
    clearValidation,
    resetForm,
    getFieldError,
    validateFieldByName,
  }
}
