<template>
  <BaseModal :show="show" size="md" @close="handleClose" :hide-scrollbar="true">
    <div class="verification-modal">
      <div class="modal-header">
        <h2 class="modal-title">{{ title }}</h2>
        <p class="modal-description">{{ description }}</p>
      </div>

      <div v-if="loading" class="loading-state">
        <LoadingSpinner size="48" />
        <p class="loading-text">Processing verification...</p>
      </div>

      <div v-else-if="error" class="error-state">
        <BaseAlert
          variant="error"
          title="Verification Failed"
          :message="error"
          :show="true"
          dismissible
          @dismiss="error = null"
        />
        <div class="error-actions">
          <BaseButton @click="handleRetry" variant="primary" size="md">
            Try Again
          </BaseButton>
          <BaseButton @click="handleClose" variant="ghost" size="md">
            Cancel
          </BaseButton>
        </div>
      </div>

      <div v-else-if="success" class="success-state">
        <div class="success-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 6L9 17l-5-5"></path>
          </svg>
        </div>
        <h3 class="success-title">Verification Complete</h3>
        <p class="success-description">Your payment method has been verified successfully.</p>
      </div>

      <div v-else class="iframe-container">
        <iframe
          v-if="iframeUrl"
          ref="iframeRef"
          :src="iframeUrl"
          class="verification-iframe"
          @load="handleIframeLoad"
        ></iframe>
        <div v-else class="preparing-state">
          <LoadingSpinner size="32" />
          <p class="preparing-text">Preparing verification...</p>
        </div>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { Stripe } from '@stripe/stripe-js'
import BaseModal from './BaseModal.vue'
import BaseAlert from './BaseAlert.vue'
import BaseButton from './BaseButton.vue'
import LoadingSpinner from './LoadingSpinner.vue'

interface Props {
  show: boolean
  stripe: Stripe | null
  clientSecret: string
  mode?: 'setup' | 'payment'
  title?: string
  description?: string
}

interface Emits {
  (e: 'verification-success'): void
  (e: 'verification-error', error: string): void
  (e: 'close'): void
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'setup',
  title: 'Verify Your Payment Method',
  description: 'Please complete the verification process to continue.'
})

const emit = defineEmits<Emits>()

const loading = ref(false)
const success = ref(false)
const error = ref<string | null>(null)
const iframeUrl = ref<string | null>(null)
const iframeRef = ref<HTMLIFrameElement | null>(null)

const isSetupIntent = computed(() => props.mode === 'setup')

watch(() => props.show, async (newShow) => {
  if (newShow) {
    await initializeVerification()
  } else {
    resetState()
  }
}, { immediate: true })

async function initializeVerification() {
  if (!props.stripe || !props.clientSecret) {
    error.value = 'Payment system not initialized'
    return
  }

  loading.value = true
  error.value = null

  try {
    if (isSetupIntent.value) {
      // Handle SetupIntent verification
      const { error: stripeError, setupIntent } = await props.stripe.confirmCardSetup(
        props.clientSecret,
        {
          // Don't provide payment method as it should already be attached
        }
      )

      if (stripeError) {
        throw new Error(stripeError.message)
      }

      if (setupIntent?.status === 'succeeded') {
        handleSuccess()
      } else if (setupIntent?.status === 'requires_action') {
        // Get the next action URL for iframe
        const nextAction = setupIntent.next_action
        if (nextAction?.type === 'redirect_to_url') {
          iframeUrl.value = nextAction.redirect_to_url?.url || null
        }
      } else {
        throw new Error(`Setup intent in unexpected state: ${setupIntent?.status}`)
      }
    } else {
      // Handle PaymentIntent verification
      const { error: stripeError, paymentIntent } = await props.stripe.confirmCardPayment(
        props.clientSecret
      )

      if (stripeError) {
        throw new Error(stripeError.message)
      }

      if (paymentIntent?.status === 'succeeded') {
        handleSuccess()
      } else if (paymentIntent?.status === 'requires_action') {
        // Get the next action URL for iframe
        const nextAction = paymentIntent.next_action
        if (nextAction?.type === 'redirect_to_url') {
          iframeUrl.value = nextAction.redirect_to_url?.url || null
        }
      } else {
        throw new Error(`Payment intent in unexpected state: ${paymentIntent?.status}`)
      }
    }
  } catch (err) {
    console.error('Verification initialization failed:', err)
    error.value = err instanceof Error ? err.message : 'Failed to initialize verification'
  } finally {
    loading.value = false
  }
}

function handleIframeLoad() {
  // Listen for messages from the iframe (e.g., 3DS completion)
  window.addEventListener('message', handleIframeMessage)
}

async function handleIframeMessage(event: MessageEvent) {
  // Stripe 3DS iframes send messages when complete
  if (event.data === '3DS-authentication-complete') {
    loading.value = true

    try {
      // Re-check the intent status
      if (isSetupIntent.value) {
        const { error: stripeError, setupIntent } = await props.stripe!.retrieveSetupIntent(props.clientSecret)

        if (stripeError) {
          throw new Error(stripeError.message)
        }

        if (setupIntent?.status === 'succeeded') {
          handleSuccess()
        } else {
          throw new Error(`Setup verification failed with status: ${setupIntent?.status}`)
        }
      } else {
        const { error: stripeError, paymentIntent } = await props.stripe!.retrievePaymentIntent(props.clientSecret)

        if (stripeError) {
          throw new Error(stripeError.message)
        }

        if (paymentIntent?.status === 'succeeded') {
          handleSuccess()
        } else {
          throw new Error(`Payment verification failed with status: ${paymentIntent?.status}`)
        }
      }
    } catch (err) {
      console.error('Verification check failed:', err)
      error.value = err instanceof Error ? err.message : 'Verification failed'
    } finally {
      loading.value = false
    }
  }
}

function handleSuccess() {
  success.value = true

  // Show success state briefly, then emit success
  setTimeout(() => {
    emit('verification-success')
    resetState()
  }, 1500)
}

function handleRetry() {
  resetState()
  initializeVerification()
}

function handleClose() {
  emit('close')
  resetState()
}

function resetState() {
  loading.value = false
  success.value = false
  error.value = null
  iframeUrl.value = null
  window.removeEventListener('message', handleIframeMessage)
}
</script>

<style scoped>
.verification-modal {
  padding: var(--space-6);
}

.modal-header {
  margin-bottom: var(--space-6);
  text-align: center;
}

.modal-title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-2) 0;
}

.modal-description {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  margin: 0;
  line-height: var(--line-height-relaxed);
}

.loading-state,
.preparing-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-8);
  text-align: center;
}

.loading-text,
.preparing-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
}

.error-state {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.error-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: center;
}

.success-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-8);
  text-align: center;
}

.success-icon {
  width: 64px;
  height: 64px;
  color: var(--color-success);
  animation: successPulse 0.6s ease-out;
}

@keyframes successPulse {
  0% {
    transform: scale(0.8);
    opacity: 0;
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.success-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.success-description {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  margin: 0;
}

.iframe-container {
  min-height: 400px;
  position: relative;
}

.verification-iframe {
  width: 100%;
  height: 500px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-primary);
}

@media (max-width: 640px) {
  .verification-modal {
    padding: var(--space-4);
  }

  .modal-header {
    margin-bottom: var(--space-4);
  }

  .modal-title {
    font-size: var(--font-size-xl);
  }

  .iframe-container {
    min-height: 300px;
  }

  .verification-iframe {
    height: 400px;
  }
}
</style>
