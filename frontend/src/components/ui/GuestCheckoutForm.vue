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
            :disabled="isRegistered"
          />
          <EditableField
            :value="formData.lastName"
            field="lastName"
            label="Last Name *"
            placeholder="Enter your last name"
            :required="true"
            :error="errors.lastName"
            @update="handleFieldUpdate"
            :disabled="isRegistered"
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
          :disabled="isRegistered"
        />

        <PhoneNumberField
          :value="formData.phoneNumber"
          field="phoneNumber"
          label="Phone Number *"
          placeholder="Enter your phone number"
          :required="true"
          :error="errors.phoneNumber"
          @update="handleFieldUpdate"
          :disabled="isRegistered"
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
          :disabled="isRegistered"
        />

        <EditableToggle
          v-if="requiresShipping"
          :value="shippingAddressSameAsAddress"
          field="shippingAddressSameAsAddress"
          on-label="Ship to billing address"
          off-label="Ship to different address"
          :required="false"
          @update="handleFieldUpdate"
          :disabled="isRegistered"
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
          :disabled="isRegistered"
        />
      </div>

      <!-- Registration Step -->
      <div v-if="!isRegistered && !waitingForStripeCustomer" class="registration-step">
        <BaseButton
          @click="handleRegistration"
          :loading="registeringUser"
          :disabled="!canRegister || registeringUser"
          variant="primary"
          full-width
          size="md"
        >
          {{ registeringUser ? 'Creating Account...' : 'Continue to Payment' }}
        </BaseButton>
      </div>

      <!-- Waiting for Stripe Customer -->
      <div v-if="waitingForStripeCustomer" class="waiting-state">
        <LoadingSpinner size="32" />
        <p class="waiting-text">Setting up your payment account...</p>
      </div>

      <!-- Payment Method Section (only show after registration) -->
      <div v-if="isRegistered && hasStripeCustomer" class="form-section">
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

        <!-- Payment Method Creation Button -->
        <BaseButton
          @click="handleSubmit"
          :loading="processing"
          :disabled="!stripeLoaded || processing || !!error"
          variant="primary"
          full-width
          size="md"
        >
          {{ processing ? 'Adding Payment Method...' : 'Add Payment Method' }}
        </BaseButton>
      </div>
    </form>

    <!-- Stripe Verification Modal -->
    <StripeVerificationModal
      v-if="showVerificationModal"
      :show="showVerificationModal"
      :stripe="stripe"
      :client-secret="verificationClientSecret || ''"
      :mode="verificationType"
      @verification-success="handleVerificationSuccess"
      @verification-error="handleVerificationError"
      @close="handleVerificationClose"
    />
  </div>
</template>

<script setup lang="ts">
import { publicApi } from '@/services/api'
import { poll } from '@/utils/polling'
import {
  loadStripe,
  type Stripe,
  type StripeCardElement,
  type StripeElements,
} from '@stripe/stripe-js'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import AddressSearch from './AddressSearch.vue'
import BaseAlert from './BaseAlert.vue'
import BaseButton from './BaseButton.vue'
import EditableField from './EditableField.vue'
import EditableToggle from './EditableToggle.vue'
import LoadingSpinner from './LoadingSpinner.vue'
import PhoneNumberField from './PhoneNumberField.vue'
import StripeVerificationModal from './StripeVerificationModal.vue'

interface GuestFormData {
  firstName: string
  lastName: string
  email: string
  phoneNumber: string
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
}

interface Emits {
  (e: 'form-completed', data: { userId: string; paymentMethodId: string }): void
  (e: 'form-updated', data: GuestFormData): void
  (e: 'payment-method-added', data: { userId: string; paymentMethodId: string }): void
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
  phoneNumber: '',
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
const error = ref<string | null>(null)
const registeringUser = ref(false)
const waitingForStripeCustomer = ref(false)
const processing = ref(false)
const stripeLoaded = ref(false)
const shippingAddressSameAsAddress = ref(true)

// Registration state
const isRegistered = ref(false)
const registeredUserId = ref<string | null>(null)
const hasStripeCustomer = ref(false)

// Verification state
const showVerificationModal = ref(false)
const verificationClientSecret = ref<string | null>(null)
const verificationType = ref<'setup' | 'payment'>('setup')
const pendingPaymentMethodId = ref<string | null>(null)

let stripe: Stripe | null = null
let elements: StripeElements | null = null
let cardElement: StripeCardElement | null = null

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY

const canRegister = computed(() => {
  return (
    formData.value.firstName &&
    formData.value.lastName &&
    formData.value.email &&
    formData.value.phoneNumber &&
    !errors.value.firstName &&
    !errors.value.lastName &&
    !errors.value.email &&
    !errors.value.phoneNumber &&
    formData.value.address.line1 &&
    formData.value.address.city &&
    formData.value.address.state &&
    formData.value.address.postal_code
  )
})

watch(hasStripeCustomer, (newValue) => {
  if (newValue) {
    initializeStripe()
  }
})

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

const handleFieldUpdate = (
  field: string,
  value: string | { [key: string]: string | undefined } | boolean | null | undefined,
) => {
  if (errors.value[field]) {
    delete errors.value[field]
  }

  switch (field) {
    case 'address':
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
    case 'phoneNumber':
      formData.value.phoneNumber = value as string
      break
    case 'shippingAddressSameAsAddress':
      shippingAddressSameAsAddress.value = value as boolean
      if (!shippingAddressSameAsAddress.value) {
        formData.value.shippingAddress = {
          line1: '',
          line2: '',
          city: '',
          state: '',
          postal_code: '',
          country: '',
        }
      } else {
        delete formData.value.shippingAddress
      }
      break
  }

  emitFormUpdate()
}

const validateEmail = (email: string) => {
  if (email && !/\S+@\S+\.\S+/.test(email)) {
    errors.value.email = 'Please enter a valid email address'
  }
}

const emitFormUpdate = () => {
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

  if (!formData.value.phoneNumber) {
    errors.value.phoneNumber = 'Phone number is required'
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

const handleRegistration = async () => {
  if (!validateForm()) {
    return
  }

  registeringUser.value = true
  error.value = null

  try {
    // Step 1: Register guest user
    const user = await publicApi.guestRegister({
      email: formData.value.email,
      given_name: formData.value.firstName,
      family_name: formData.value.lastName,
      phone_number: formData.value.phoneNumber,
      address: {
        line_1: formData.value.address.line1,
        line_2: formData.value.address.line2,
        city: formData.value.address.city,
        state: formData.value.address.state,
        postal_code: formData.value.address.postal_code,
        country: formData.value.address.country,
      },
    })

    isRegistered.value = true
    registeredUserId.value = user.id

    // Step 2: Poll for Stripe customer creation
    waitingForStripeCustomer.value = true

    const stripeCustomerResult = await poll({
      checkFn: async () => {
        const status = await publicApi.checkGuestStripeCustomerStatus(user.id)
        return status.has_stripe_customer
      },
      conditionFn: (hasCustomer) => !hasCustomer, // Continue while false
      maxAttempts: 30,
      initialDelay: 1000,
      maxDelay: 3000,
      useExponentialBackoff: false,
    })

    if (!stripeCustomerResult.success || !stripeCustomerResult.data) {
      throw new Error('Failed to create Stripe customer. Please try again.')
    }

    hasStripeCustomer.value = true
    waitingForStripeCustomer.value = false
  } catch (err) {
    console.error('Registration failed:', err)
    error.value = err instanceof Error ? err.message : 'Registration failed. Please try again.'
    isRegistered.value = false
    registeredUserId.value = null
  } finally {
    registeringUser.value = false
    waitingForStripeCustomer.value = false
  }
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
  if (!stripe || !cardElement || !registeredUserId.value) {
    error.value = 'Payment system not ready'
    return
  }

  processing.value = true
  error.value = null

  try {
    // Step 3: Create payment method with Stripe
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

    // Create payment method on backend
    const response = await publicApi.publicCreatePaymentMethod({
      user_id: registeredUserId.value,
      id: paymentMethod.id,
      last_four_digits: paymentMethod.card?.last4 || '',
      brand: paymentMethod.card?.brand || '',
      expiry_month: paymentMethod.card?.exp_month || 0,
      expiry_year: paymentMethod.card?.exp_year || 0,
    })

    // Check if verification is required
    if (response.requires_action && response.setup_intent_client_secret) {
      pendingPaymentMethodId.value = paymentMethod.id
      verificationClientSecret.value = response.setup_intent_client_secret
      verificationType.value = 'setup'
      showVerificationModal.value = true
      return
    }

    // No verification needed - payment method is active
    pendingPaymentMethodId.value = paymentMethod.id

    // Emit payment method added event
    emit('payment-method-added', {
      userId: registeredUserId.value,
      paymentMethodId: paymentMethod.id,
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

const handleVerificationSuccess = async () => {
  showVerificationModal.value = false
  verificationClientSecret.value = null

  if (!registeredUserId.value || !pendingPaymentMethodId.value) {
    error.value = 'Session expired. Please try again.'
    return
  }

  processing.value = true

  try {
    // Step 3b: Poll for payment method to become active
    const paymentMethodResult = await poll({
      checkFn: async () => {
        const status = await publicApi.checkPaymentMethodStatus(
          registeredUserId.value!,
          pendingPaymentMethodId.value!
        )
        return status.status
      },
      conditionFn: (status) => status !== 'active', // Continue while not active
      maxAttempts: 20,
      initialDelay: 1000,
      maxDelay: 3000,
      useExponentialBackoff: false,
    })

    if (!paymentMethodResult.success || paymentMethodResult.data !== 'active') {
      throw new Error('Payment method verification timed out. Please try again.')
    }

    // Payment method is now active - store for later use
    // Don't clear pendingPaymentMethodId as it will be used for checkout

    // Emit payment method added event
    emit('payment-method-added', {
      userId: registeredUserId.value,
      paymentMethodId: pendingPaymentMethodId.value,
    })
  } catch (err) {
    console.error('Payment method verification failed:', err)
    error.value = err instanceof Error ? err.message : 'Verification failed. Please try again.'
    pendingPaymentMethodId.value = null
  } finally {
    processing.value = false
  }
}

const handleVerificationError = (errorMessage: string) => {
  showVerificationModal.value = false
  verificationClientSecret.value = null
  error.value = errorMessage
  processing.value = false
  pendingPaymentMethodId.value = null
}

const handleVerificationClose = () => {
  showVerificationModal.value = false
  verificationClientSecret.value = null
  processing.value = false
  pendingPaymentMethodId.value = null
}

onMounted(() => {
  // Stripe initialization happens after registration
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

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.registration-step {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

.waiting-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-6);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.waiting-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
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

/* Responsive design */
@media (max-width: 640px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
