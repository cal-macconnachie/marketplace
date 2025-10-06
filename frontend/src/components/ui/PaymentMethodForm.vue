<template>
  <div class="payment-method-form">
    <div class="form-content">
      <!-- Profile incomplete state -->
      <div v-if="!canAddPaymentMethod" class="profile-incomplete">
        <div class="incomplete-icon">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </div>
        <h3 class="incomplete-title">Complete Your Profile</h3>
        <p class="incomplete-description">
          Please add your name and address in the Profile Information section above to enable
          payment methods.
        </p>
        <div class="incomplete-requirements">
          <div class="requirement" :class="{ completed: hasValidName }">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path v-if="hasValidName" d="M20 6L9 17l-5-5"></path>
              <circle v-else cx="12" cy="12" r="10"></circle>
            </svg>
            <span>Full name (first and last name)</span>
          </div>
          <div class="requirement" :class="{ completed: hasValidAddress }">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path v-if="hasValidAddress" d="M20 6L9 17l-5-5"></path>
              <circle v-else cx="12" cy="12" r="10"></circle>
            </svg>
            <span>Address</span>
          </div>
        </div>

        <div v-if="waitingForStripeCustomer" class="waiting-state">
          <div class="loading-spinner">
            <svg class="spinner" width="20" height="20" viewBox="0 0 24 24">
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="2"
                fill="none"
                stroke-linecap="round"
                stroke-dasharray="31.416"
                stroke-dashoffset="31.416"
              >
                <animate
                  attributeName="stroke-dasharray"
                  dur="2s"
                  values="0 31.416;15.708 15.708;0 31.416"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="stroke-dashoffset"
                  dur="2s"
                  values="0;-15.708;-31.416"
                  repeatCount="indefinite"
                />
              </circle>
            </svg>
          </div>
          <p class="waiting-text">Setting up your payment account...</p>
        </div>
      </div>

      <!-- Payment form (when profile is complete and no payment method exists) -->
      <div v-else class="payment-form">
        <div v-if="!stripeLoaded" class="loading-overlay">
          <div class="loading-spinner">
            <svg class="spinner" width="24" height="24" viewBox="0 0 24 24">
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="2"
                fill="none"
                stroke-linecap="round"
                stroke-dasharray="31.416"
                stroke-dashoffset="31.416"
              >
                <animate
                  attributeName="stroke-dasharray"
                  dur="2s"
                  values="0 31.416;15.708 15.708;0 31.416"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="stroke-dashoffset"
                  dur="2s"
                  values="0;-15.708;-31.416"
                  repeatCount="indefinite"
                />
              </circle>
            </svg>
          </div>
        </div>

        <div v-if="error" class="error-overlay">
          <BaseAlert
            variant="error"
            title="Payment Setup Error"
            :message="error"
            :show="true"
            dismissible
            @dismiss="error = null"
          />
        </div>

        <div class="form-group" :class="{ 'form-disabled': !stripeLoaded || error }">
          <div id="card-element" class="stripe-card-element">
            <!-- Stripe Card Element will mount here -->
          </div>
        </div>

        <div class="form-actions">
          <BaseButton
            @click="handleSubmit"
            :loading="processing"
            :disabled="processing || !stripeLoaded || !!error"
            variant="primary"
            full-width
          >
            {{ processing ? 'Adding Payment Method...' : 'Add Payment Method' }}
          </BaseButton>
        </div>
      </div>

      <!-- Success State -->
      <BaseAlert
        v-if="success"
        variant="success"
        title="Payment Method Added"
        message="Your payment method has been successfully added to your account."
        :show="success"
        dismissible
        @dismiss="success = false"
        class="success-alert"
      />
    </div>

    <!-- Payment Verification Modal -->
    <PaymentVerificationModal
      :show="showVerificationModal"
      :stripe="stripe"
      :client-secret="verificationClientSecret ?? undefined"
      @success="handleVerificationSuccess"
      @error="handleVerificationError"
      @close="handleVerificationClose"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import {
  loadStripe,
  type Stripe,
  type StripeElements,
  type StripeCardElement,
} from '@stripe/stripe-js'
import { useAppStore } from '@/stores/app'
import {
  authAPI
} from '@/services/api'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import PaymentVerificationModal from '@/components/ui/PaymentVerificationModal.vue'
import type { CreatePaymentMethodRequest, CreatePaymentMethodResponse } from '@marketplace/types'

interface Emits {
  (e: 'paymentMethodAdded'): void
}

const emit = defineEmits<Emits>()
const app = useAppStore()

const stripeLoaded = ref(false)
const processing = ref(false)
const success = ref(false)
const error = ref<string | null>(null)
const waitingForStripeCustomer = ref(false)
const showVerificationModal = ref(false)
const verificationClientSecret = ref<string | null>(null)

// Profile validation computed properties
const canAddPaymentMethod = computed(
  () => !!app.user?.stripe_id && hasValidAddress.value && hasValidName.value,
)
const hasValidName = computed(() => !!(app.user?.given_name && app.user?.family_name))
const hasValidAddress = computed(() => !!app.user?.address)

let stripe: Stripe | null = null
let elements: StripeElements | null = null
let cardElement: StripeCardElement | null = null

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY

// Watch for profile completion to trigger Stripe customer creation check
watch(
  [hasValidName, hasValidAddress],
  ([nameValid, addressValid], [prevNameValid, prevAddressValid]) => {
    // If name and address just became valid and user doesn't have stripe_id, wait for it to be created
    if (
      nameValid &&
      addressValid &&
      (!prevNameValid || !prevAddressValid) &&
      app.user &&
      !app.user.stripe_id
    ) {
      waitingForStripeCustomer.value = true

      // Poll for stripe_id creation with retries
      const checkForStripeId = async (attempts = 0) => {
        const maxAttempts = 10
        const delay = 2000 // 2 seconds between attempts

        try {
          await app.fetchCurrentUser()

          if (app.user?.stripe_id) {
            waitingForStripeCustomer.value = false
            return
          }

          if (attempts < maxAttempts) {
            setTimeout(() => checkForStripeId(attempts + 1), delay)
          } else {
            // Give up after max attempts
            console.warn('Stripe customer creation timed out')
            waitingForStripeCustomer.value = false
          }
        } catch (error) {
          console.error('Failed to refresh user data:', error)
          if (attempts < maxAttempts) {
            setTimeout(() => checkForStripeId(attempts + 1), delay)
          } else {
            waitingForStripeCustomer.value = false
          }
        }
      }

      // Start polling after a short delay
      setTimeout(() => checkForStripeId(), 1000)
    }
  },
)

// Watch for payment method eligibility to initialize Stripe
watch(
  canAddPaymentMethod,
  async (canAdd, wasCanAdd) => {
    if (canAdd && !stripeLoaded.value) {
      // Reset state before initializing
      resetState()
      await initializeStripe()
    } else if (!canAdd && wasCanAdd) {
      // Clean up when no longer eligible
      cleanupStripe()
    }
  },
  { immediate: true },
)

function resetState() {
  stripeLoaded.value = false
  processing.value = false
  error.value = null
  success.value = false
}

function cleanupStripe() {
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
  resetState()
}

async function initializeStripe() {
  if (!stripePublishableKey) {
    error.value =
      'Stripe configuration is missing. Please add VITE_STRIPE_PUBLISHABLE_KEY to your .env file.'
    console.error('VITE_STRIPE_PUBLISHABLE_KEY not found in environment variables')
    console.error('Available env vars:', Object.keys(import.meta.env))
    return
  }

  // Add timeout to prevent infinite loading
  const timeoutId = setTimeout(() => {
    if (!stripeLoaded.value) {
      error.value =
        'Stripe is taking too long to load. Please check your internet connection and API key.'
      console.error('Stripe loading timeout')
    }
  }, 10000) // 10 second timeout

  try {
    // Load Stripe with a simple approach
    stripe = await loadStripe(stripePublishableKey)
    clearTimeout(timeoutId)

    if (!stripe) {
      throw new Error('loadStripe returned null - check API key format')
    }

    // Create elements with simple configuration
    elements = stripe.elements()

    // Create simple card element with basic styling
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
    // Wait for the next tick to ensure DOM is ready
    await nextTick()

    // Double check the element exists
    const cardElementDiv = document.getElementById('card-element')

    if (!cardElementDiv) {
      throw new Error('Card element container not found in DOM')
    }

    cardElement.mount('#card-element')

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
    clearTimeout(timeoutId)

    if (err instanceof Error) {
      if (err.message.includes('timeout')) {
        error.value = 'Stripe is taking too long to load. Please check your internet connection.'
      } else if (err.message.includes('Invalid publishable key')) {
        error.value = 'Invalid Stripe API key. Please check your VITE_STRIPE_PUBLISHABLE_KEY.'
      } else {
        error.value = `Failed to initialize Stripe: ${err.message}`
      }
    } else {
      error.value = 'Failed to initialize payment system. Please refresh and try again.'
    }
  }
}

onMounted(() => {
  // Stripe initialization is now handled by the canAddPaymentMethod watcher
})

onUnmounted(() => {
  cleanupStripe()
})

async function handleSubmit() {
  if (!stripe || !cardElement || !app.user?.id) {
    error.value = 'Payment system not ready or user not authenticated'
    return
  }

  processing.value = true
  error.value = null

  try {
    // Create payment method with Stripe using the card element
    const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
    })

    if (stripeError) {
      throw new Error(stripeError.message)
    }

    if (!paymentMethod) {
      throw new Error('Failed to create payment method')
    }

    // Extract payment method details
    const card = paymentMethod.card
    if (!card) {
      throw new Error('Invalid payment method created')
    }

    // Send payment method data to our API
    const paymentMethodData: CreatePaymentMethodRequest = {
      user_id: app.user.id,
      id: paymentMethod.id,
      last_four_digits: card.last4,
      brand: card.brand,
      expiry_month: card.exp_month,
      expiry_year: card.exp_year,
    }

    const response: CreatePaymentMethodResponse = await authAPI.createPaymentMethod(
      paymentMethodData,
    )

    // Check if verification is required
    if (response.requires_action && response.setup_intent_client_secret) {
      verificationClientSecret.value = response.setup_intent_client_secret
      showVerificationModal.value = true
      // Don't clear the form yet, wait for verification
      return
    }

    // Success! Reset form and show success message
    handlePaymentMethodSuccess()
  } catch (err: unknown) {
    console.error('Payment method creation failed:', err)
    if (err instanceof Error) {
      error.value = err.message || 'Failed to add payment method. Please try again.'
    } else {
      error.value = 'Failed to add payment method. Please try again.'
    }
  } finally {
    processing.value = false
  }
}

function handlePaymentMethodSuccess() {
  success.value = true

  // Clear the card element
  if (cardElement) {
    cardElement.clear()
  }

  // Emit event to parent component
  emit('paymentMethodAdded')

  // Auto-hide success message after 3 seconds
  setTimeout(() => {
    success.value = false
  }, 3000)
}

async function handleVerificationSuccess() {
  showVerificationModal.value = false
  verificationClientSecret.value = null

  // Wait a couple seconds for backend to update payment method status
  await new Promise(resolve => setTimeout(resolve, 2000))

  handlePaymentMethodSuccess()
}

function handleVerificationError(errorMessage: string) {
  error.value = errorMessage
  showVerificationModal.value = false
  verificationClientSecret.value = null
  processing.value = false
}

async function handleVerificationClose() {
  showVerificationModal.value = false
  verificationClientSecret.value = null
  processing.value = false

  // Wait a couple seconds then refetch payment methods in case verification completed
  await new Promise(resolve => setTimeout(resolve, 2000))
  emit('paymentMethodAdded')
}
</script>

<style scoped>
.payment-method-form {
  width: 100%;
  margin: 0 auto;
}

.form-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.loading-overlay,
.error-overlay {
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
  gap: var(--space-4);
  padding: var(--space-8);
  border-radius: var(--radius-md);
  z-index: 10;
}

.form-disabled {
  opacity: 0.5;
  pointer-events: none;
}

.loading-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
}

.spinner {
  color: var(--color-primary);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
}

.loading-debug {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin: var(--space-2) 0;
  opacity: 0.7;
}

.payment-form {
  display: flex;
  flex-direction: column;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.form-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.form-input {
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-alpha);
}

.form-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: var(--color-bg-muted);
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
  width: 100%;
}

.stripe-card-element:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-alpha);
}

.form-actions {
  margin-top: var(--space-2);
}

.success-alert {
  margin-top: var(--space-4);
}

/* Profile incomplete state styles */
.profile-incomplete {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-6);
  padding: var(--space-8);
  text-align: center;
}

.incomplete-icon {
  color: var(--color-text-secondary);
  opacity: 0.7;
}

.incomplete-title {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.incomplete-description {
  margin: 0;
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  max-width: 400px;
  line-height: var(--line-height-relaxed);
}

.incomplete-requirements {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 100%;
  max-width: 300px;
}

.requirement {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  transition: all 0.2s ease;
}

.requirement.completed {
  border-color: var(--color-success);
  background: var(--color-success-bg, rgba(34, 197, 94, 0.1));
  color: var(--color-success);
}

.requirement svg {
  flex-shrink: 0;
  color: var(--color-text-secondary);
  transition: color 0.2s ease;
}

.requirement.completed svg {
  color: var(--color-success);
}

.requirement span {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
}

.requirement.completed span {
  color: var(--color-success-dark, var(--color-success));
}

.waiting-state {
  margin-top: var(--space-4);
  padding: var(--space-4);
  border: 1px solid var(--color-primary-alpha);
  border-radius: var(--radius-md);
  background: var(--color-primary-bg, rgba(59, 130, 246, 0.1));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}

.waiting-text {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-primary);
  font-weight: var(--font-weight-medium);
}

.payment-method-exists {
  margin-top: var(--space-4);
  display: flex;
  justify-content: center;
}

.check-icon {
  color: var(--color-success);
}

/* Responsive design */
@media (max-width: 640px) {
  .payment-method-form {
    max-width: none;
  }

  .loading-state,
  .error-state {
    padding: var(--space-6);
  }

  .profile-incomplete {
    padding: var(--space-6);
  }

  .incomplete-description {
    font-size: var(--font-size-sm);
  }

  .incomplete-requirements {
    max-width: none;
  }
}
</style>
