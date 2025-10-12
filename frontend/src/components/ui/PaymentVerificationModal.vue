<template>
  <BaseModal
    :show="show"
    title="Payment Method Verification"
    size="md"
    :disable-close="isVerifying"
    @close="handleClose"
  >
    <template #default>
      <p class="verification-message">
        Your bank requires additional verification to confirm this payment method. Please complete
        the verification process below.
      </p>

      <div v-if="verificationError" class="error-message">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10" stroke-width="2" />
          <path d="M12 8v4m0 4h.01" stroke-width="2" stroke-linecap="round" />
        </svg>
        <span>{{ verificationError }}</span>
      </div>

      <div class="iframe-container" :class="{ loading: isVerifying }">
        <div v-if="isVerifying" class="loading-overlay">
          <div class="loading-spinner">
            <svg class="spinner" width="40" height="40" viewBox="0 0 24 24">
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
          <p class="loading-text">Verifying payment method...</p>
        </div>

        <div id="stripe-verification-container" ref="verificationContainer"></div>
      </div>
    </template>

    <template #footer>
      <BaseButton variant="outline" @click="handleClose" :disabled="isVerifying">
        Cancel
      </BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted, nextTick } from 'vue'
import type { Stripe } from '@stripe/stripe-js'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'

interface Props {
  show: boolean
  stripe: Stripe | null
  clientSecret?: string
}

interface Emits {
  (e: 'close'): void
  (e: 'verification-success'): void
  (e: 'verification-error', error: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const isVerifying = ref(false)
const verificationError = ref<string | null>(null)
const verificationContainer = ref<HTMLElement | null>(null)

// Watch for when the modal opens to start verification
watch(
  () => props.show,
  async (newShow) => {
    if (newShow && props.stripe && props.clientSecret) {
      await handleVerification()
    }
  },
  { immediate: true },
)

async function handleVerification() {
  if (!props.stripe || !props.clientSecret) {
    verificationError.value = 'Verification setup failed. Please try again.'
    return
  }

  isVerifying.value = true
  verificationError.value = null

  try {
    // Wait for the DOM to be ready
    await nextTick()

    // Use Stripe's confirmCardSetup with the client secret
    const { error, setupIntent } = await props.stripe.confirmCardSetup(props.clientSecret, {
      // Stripe will automatically handle 3D Secure and other verification methods
    })

    if (error) {
      console.error('Verification error:', error)
      verificationError.value = error.message || 'Verification failed. Please try again.'
      emit('verification-error', verificationError.value)
    } else if (setupIntent) {
      // Verification successful
      if (setupIntent.status === 'succeeded') {
        emit('verification-success')
      } else if (setupIntent.status === 'requires_action') {
        verificationError.value =
          'Additional verification required. Please contact your bank or try a different card.'
        emit('verification-error', verificationError.value)
      } else {
        verificationError.value = `Verification status: ${setupIntent.status}. Please try again.`
        emit('verification-error', verificationError.value)
      }
    }
  } catch (err) {
    console.error('Verification failed:', err)
    verificationError.value = 'Verification failed. Please try again.'
    emit('verification-error', verificationError.value)
  } finally {
    isVerifying.value = false
  }
}

function handleClose() {
  if (!isVerifying.value) {
    emit('close')
  }
}

onUnmounted(() => {
  // Clean up any resources if needed
})
</script>

<style scoped>
.verification-message {
  margin: 0 0 var(--space-6) 0;
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  line-height: var(--line-height-relaxed);
}

.error-message {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-error-bg, rgba(239, 68, 68, 0.1));
  border: 1px solid var(--color-error, #ef4444);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
  color: var(--color-error, #ef4444);
  font-size: var(--font-size-sm);
}

.error-message svg {
  flex-shrink: 0;
}

.iframe-container {
  position: relative;
  min-height: 400px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-primary);
  overflow: hidden;
}

.iframe-container.loading {
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-bg-primary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  z-index: 10;
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
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  margin: 0;
}

#stripe-verification-container {
  width: 100%;
  min-height: 400px;
}

/* Responsive design */
@media (max-width: 640px) {
  .iframe-container {
    min-height: 300px;
  }

  #stripe-verification-container {
    min-height: 300px;
  }
}
</style>
