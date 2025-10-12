<template>
  <div class="guest-checkout-form">
    <form @submit.prevent="handleSubmit" class="checkout-form">
      <!-- Personal Information -->
      <div class="form-section">
        <div class="form-row">
          <EditableField
            :value="formData.firstName"
            field="firstName"
            label="First Name *"
            placeholder="Enter your first name"
            :required="true"
            :error="errors.firstName"
            @update="handleFieldUpdate"
          />
          <EditableField
            :value="formData.lastName"
            field="lastName"
            label="Last Name *"
            placeholder="Enter your last name"
            :required="true"
            :error="errors.lastName"
            @update="handleFieldUpdate"
          />
        </div>
        <EditableField
          :value="formData.email"
          field="email"
          label="Email Address *"
          placeholder="Enter your email"
          :required="true"
          :error="errors.email"
          @update="handleFieldUpdate"
        />

        <AddressSearch
          :value="formatAddress(formData.address)"
          label="Address *"
          field="address"
          placeholder="Search for your address..."
          :required="true"
          :error="
            errors.address || errors.addressCity || errors.addressState || errors.addressPostal
          "
          @update="handleFieldUpdate"
        />

        <EditableToggle
          v-if="requiresShipping"
          :value="shippingAddressSameAsAddress"
          field="shippingAddressSameAsAddress"
          on-label="Ship to billing address"
          off-label="Ship to different address"
          :required="false"
          @update="handleFieldUpdate"
        />

        <AddressSearch
          v-if="requiresShipping && !shippingAddressSameAsAddress"
          :value="formatAddress(formData.shippingAddress)"
          label="Shipping Address"
          field="shippingAddress"
          placeholder="Search for your address..."
          :required="true"
          :error="
            errors.shippingAddress ||
            errors.shippingAddressCity ||
            errors.shippingAddressState ||
            errors.shippingAddressPostal
          "
          @update="handleFieldUpdate"
        />
      </div>

      <!-- Payment Method -->
      <div v-if="hasCustomer" class="form-section">
        <div v-if="!stripeLoaded" class="loading-overlay">
          <LoadingSpinner />
        </div>

        <BaseAlert
          v-if="error"
          variant="error"
          title="Payment Setup Error"
          :message="error"
          :show="true"
          dismissible
          @dismiss="error = null"
        />

        <div class="payment-element-container" :class="{ 'form-disabled': !stripeLoaded || error }">
          <div id="guest-card-element" class="stripe-card-element">
            <!-- Stripe Card Element will mount here -->
          </div>
        </div>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import {
  loadStripe,
  type Stripe,
  type StripeElements,
  type StripeCardElement,
  type PaymentMethod,
} from '@stripe/stripe-js'
import BaseAlert from './BaseAlert.vue'
import LoadingSpinner from './LoadingSpinner.vue'
import AddressSearch from './AddressSearch.vue'
import EditableField from './EditableField.vue'
import EditableToggle from './EditableToggle.vue'

interface GuestFormData {
  firstName: string
  lastName: string
  email: string
  address: {
    line1: string
    line2: string
    city: string
    state: string
    postal_code: string
    country: string
  }
  shippingAddress?: {
    line1: string
    line2: string
    city: string
    state: string
    postal_code: string
    country: string
  }
  paymentMethodId?: PaymentMethod
}

interface Emits {
  (e: 'form-completed', data: GuestFormData & { paymentMethod: PaymentMethod }): void
  (e: 'form-updated', data: GuestFormData): void
  (e: 'verification-required', data: { clientSecret: string; paymentMethod: PaymentMethod }): void
}

const emit = defineEmits<Emits>()

const props = defineProps({
  requiresShipping: {
    type: Boolean,
    default: false,
  },
})

const formData = ref<GuestFormData>({
  firstName: '',
  lastName: '',
  email: '',
  address: {
    line1: '',
    line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
  },
})

const errors = ref<Record<string, string>>({})
const processing = ref(false)
const stripeLoaded = ref(false)
const error = ref<string | null>(null)
const hasCustomer = ref(false)
const shippingAddressSameAsAddress = ref(true)

const isBillingDisabled = computed(() => {
  return (
    !formData.value.firstName ||
    !formData.value.lastName ||
    !formData.value.email ||
    !!errors.value.firstName ||
    !!errors.value.lastName ||
    !!errors.value.email ||
    !formData.value.address.line1 ||
    !formData.value.address.city ||
    !formData.value.address.state ||
    !formData.value.address.postal_code
  )
})

watch(isBillingDisabled, (newValue) => {
  if (!newValue && hasCustomer.value === false) {
    hasCustomer.value = true
    // refetch user
  }
})

watch(hasCustomer, (newValue) => {
  if (newValue) {
    initializeStripe()
  }
})

let stripe: Stripe | null = null
let elements: StripeElements | null = null
let cardElement: StripeCardElement | null = null

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY

const formatAddress = (address?: {
  line1?: string
  line2?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
}) => {
  if (!address || !address.line1) return ''
  const parts = [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.postal_code,
    address.country,
  ].filter(Boolean)
  return parts.join(', ')
}

// Handler for EditableField updates
const handleFieldUpdate = (
  field: string,
  value: string | { [key: string]: string | undefined } | boolean | null | undefined,
) => {
  // Clear validation error for this field when user updates it
  if (errors.value[field]) {
    delete errors.value[field]
  }
  switch (field) {
    case 'address':
      // Clear address-related validation errors when user updates address
      delete errors.value.address
      delete errors.value.addressCity
      delete errors.value.addressState
      delete errors.value.addressPostal

      if (typeof value === 'object' && value !== null) {
        const addressValue = value as {
          line_1?: string
          line_2?: string
          city?: string
          state?: string
          country?: string
          postal_code?: string
        }
        formData.value.address = {
          line1: addressValue.line_1 || '',
          line2: addressValue.line_2 || '',
          city: addressValue.city || '',
          state: addressValue.state || '',
          postal_code: addressValue.postal_code || '',
          country: addressValue.country || '',
        }
      }
      break
    case 'shippingAddress':
      delete errors.value.shippingAddress
      delete errors.value.shippingAddressCity
      delete errors.value.shippingAddressState
      delete errors.value.shippingAddressPostal

      if (typeof value === 'object' && value !== null) {
        const shippingAddressValue = value as {
          line_1?: string
          line_2?: string
          city?: string
          state?: string
          postal_code?: string
          country?: string
        }
        formData.value.shippingAddress = {
          line1: shippingAddressValue.line_1 || '',
          line2: shippingAddressValue.line_2 || '',
          city: shippingAddressValue.city || '',
          state: shippingAddressValue.state || '',
          postal_code: shippingAddressValue.postal_code || '',
          country: shippingAddressValue.country || '',
        }
      }
      break
    case 'firstName':
      formData.value.firstName = value as string
      break
    case 'lastName':
      formData.value.lastName = value as string
      break
    case 'email':
      formData.value.email = value as string
      validateEmail(value as string)
      break
    case 'shippingAddressSameAsAddress':
      shippingAddressSameAsAddress.value = value as boolean
      if (!shippingAddressSameAsAddress.value) {
        // Initialize empty shipping address when user wants different address
        formData.value.shippingAddress = {
          line1: '',
          line2: '',
          city: '',
          state: '',
          postal_code: '',
          country: '',
        }
      } else {
        // Remove shipping address when using billing address
        delete formData.value.shippingAddress
      }
      break
  }

  // Emit form update after any field change
  emitFormUpdate()
}

const validateEmail = (email: string) => {
  if (email && !/\S+@\S+\.\S+/.test(email)) {
    errors.value.email = 'Please enter a valid email address'
  }
}

const emitFormUpdate = () => {
  // Only emit if we have the basic required fields
  if (formData.value.firstName && formData.value.lastName && formData.value.email) {
    emit('form-updated', formData.value)
  }
}

const validateForm = (): boolean => {
  errors.value = {}

  if (!formData.value.firstName) {
    errors.value.firstName = 'First name is required'
  }

  if (!formData.value.lastName) {
    errors.value.lastName = 'Last name is required'
  }

  if (!formData.value.email) {
    errors.value.email = 'Email is required'
  } else if (!/\S+@\S+\.\S+/.test(formData.value.email)) {
    errors.value.email = 'Please enter a valid email address'
  }

  if (!formData.value.address.line1) {
    errors.value.address = 'Address is required'
  }

  if (!formData.value.address.city) {
    errors.value.addressCity = 'City is required'
  }

  if (!formData.value.address.state) {
    errors.value.addressState = 'State is required'
  }

  if (!formData.value.address.postal_code) {
    errors.value.addressPostal = 'Postal code is required'
  }

  // Validate shipping address if required and different from billing
  if (props.requiresShipping && !shippingAddressSameAsAddress.value) {
    if (!formData.value.shippingAddress?.line1) {
      errors.value.shippingAddress = 'Shipping address is required'
    }

    if (!formData.value.shippingAddress?.city) {
      errors.value.shippingAddressCity = 'Shipping city is required'
    }

    if (!formData.value.shippingAddress?.state) {
      errors.value.shippingAddressState = 'Shipping state is required'
    }

    if (!formData.value.shippingAddress?.postal_code) {
      errors.value.shippingAddressPostal = 'Shipping postal code is required'
    }
  }

  return Object.keys(errors.value).length === 0
}

const initializeStripe = async () => {
  if (!stripePublishableKey) {
    error.value = 'Payment system configuration error. Please contact support.'
    return
  }

  try {
    stripe = await loadStripe(stripePublishableKey)

    if (!stripe) {
      throw new Error('Failed to load payment system')
    }

    elements = stripe.elements()

    cardElement = elements.create('card', {
      hidePostalCode: true,
      style: {
        base: {
          fontSize: '16px',
          color: '#424770',
          '::placeholder': {
            color: '#aab7c4',
          },
        },
        invalid: {
          color: '#9e2146',
        },
      },
    })

    await nextTick()

    const cardElementDiv = document.getElementById('guest-card-element')
    if (!cardElementDiv) {
      throw new Error('Payment form container not found')
    }

    cardElement.mount('#guest-card-element')

    cardElement.on('change', (event) => {
      if (event.error) {
        error.value = event.error.message
      } else {
        error.value = null
      }

      // Auto-submit when card is complete and form is valid
      if (event.complete && !error?.value && !processing?.value) {
        handleSubmit()
      }
    })

    stripeLoaded.value = true
  } catch (err) {
    console.error('Failed to initialize Stripe:', err)
    error.value = 'Failed to load payment system. Please refresh the page and try again.'
  }
}

const cleanupStripe = () => {
  if (cardElement) {
    try {
      cardElement.unmount()
    } catch (e) {
      console.warn('Error unmounting card element:', e)
    }
    cardElement = null
  }
  elements = null
  stripe = null
  stripeLoaded.value = false
}

const handleSubmit = async () => {
  if (!validateForm() || !stripe || !cardElement) {
    return
  }

  processing.value = true
  error.value = null

  try {
    const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
      billing_details: {
        name: `${formData.value.firstName} ${formData.value.lastName}`,
        email: formData.value.email,
        address: {
          line1: formData.value.address.line1,
          line2: formData.value.address.line2 || undefined,
          city: formData.value.address.city,
          state: formData.value.address.state,
          postal_code: formData.value.address.postal_code,
        },
      },
    })

    if (stripeError) {
      throw new Error(stripeError.message)
    }

    if (!paymentMethod) {
      throw new Error('Failed to create payment method')
    }

    // Emit form completion with all data
    emit('form-completed', {
      ...formData.value,
      paymentMethod,
    })
  } catch (err: unknown) {
    console.error('Payment method creation failed:', err)
    if (err instanceof Error) {
      error.value = err.message
    } else {
      error.value = 'Failed to process payment information. Please try again.'
    }
  } finally {
    processing.value = false
  }
}

// Expose submitForm method to parent (must be after handleSubmit is defined)
defineExpose({
  submitForm: handleSubmit,
})

onMounted(() => {
  // Don't initialize Stripe immediately - wait for form to be filled
  // initializeStripe will be called when billing is enabled
})

onUnmounted(() => {
  cleanupStripe()
})
</script>

<style scoped>
.guest-checkout-form {
  width: 100%;
}

.checkout-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.section-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--color-border);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.form-row:has(:nth-child(3)) {
  grid-template-columns: 1fr 1fr 1fr;
}

.form-section > .form-row,
.form-section > :not(.form-row) {
  margin-bottom: var(--space-4);
}

.form-section > :last-child {
  margin-bottom: 0;
}

.payment-element-container {
  position: relative;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-8);
  border-radius: var(--radius-md);
  z-index: 10;
}

.loading-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
}

.form-disabled {
  opacity: 0.5;
  pointer-events: none;
}

.stripe-card-element {
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  min-height: 44px;
}

.stripe-card-element:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-alpha);
}

.form-actions {
  margin-top: var(--space-4);
}

/* Responsive design */
@media (max-width: 640px) {
  .form-row {
    grid-template-columns: 1fr;
  }

  .form-row:has(:nth-child(3)) {
    grid-template-columns: 1fr;
  }

  .section-title {
    font-size: var(--font-size-base);
  }
}
</style>
