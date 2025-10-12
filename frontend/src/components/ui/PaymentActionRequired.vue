<template>
  <BaseAlert
    v-if="purchasesRequiringAction.length > 0"
    variant="warning"
    title="Payment Verification Required"
    :show="true"
    :dismissible="false"
    class="payment-action-alert"
  >
    <template #message>
      <p class="alert-message">
        You have {{ purchasesRequiringAction.length }} purchase{{
          purchasesRequiringAction.length > 1 ? 's' : ''
        }}
        that require additional verification to complete payment.
      </p>
      <BaseButton
        @click="handleVerifyPayments"
        variant="primary"
        size="sm"
        :loading="verifying"
        class="verify-button"
      >
        Verify Payment{{ purchasesRequiringAction.length > 1 ? 's' : '' }}
      </BaseButton>
    </template>
  </BaseAlert>

  <!-- Payment Verification Modal -->
  <PaymentVerificationModal
    v-if="showVerificationModal && currentPurchase && stripe"
    :show="showVerificationModal"
    :client-secret="currentPurchase.requires_action.client_secret"
    @verification-success="handleVerificationSuccess"
    @verification-error="handleVerificationError"
    @close="handleVerificationClose"
    :stripe="stripe"
  />
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import type { Purchase } from '@marketplace/types'
import type { Stripe } from '@stripe/stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import BaseAlert from './BaseAlert.vue'
import BaseButton from './BaseButton.vue'
import PaymentVerificationModal from './PaymentVerificationModal.vue'

const appStore = useAppStore()
const stripe = ref<Stripe | null>(null)
const verifying = ref(false)
const showVerificationModal = ref(false)
const currentPurchaseIndex = ref(0)

// Get purchases that require action
const purchasesRequiringAction = computed(() => {
  return appStore.userPurchases.filter(
    (purchase) =>
      purchase.requires_action &&
      purchase.requires_action.client_secret &&
      purchase.status === 'pending'
  )
})

const currentPurchase = computed(() => {
  if (currentPurchaseIndex.value < purchasesRequiringAction.value.length) {
    return purchasesRequiringAction.value[currentPurchaseIndex.value]
  }
  return null
})

const handleVerifyPayments = async () => {
  if (purchasesRequiringAction.value.length === 0) return

  verifying.value = true
  currentPurchaseIndex.value = 0
  showVerificationModal.value = true
}

const handleVerificationSuccess = async () => {
  showVerificationModal.value = false

  // Move to next purchase requiring action
  currentPurchaseIndex.value++

  // If there are more purchases to verify, show modal again
  if (currentPurchaseIndex.value < purchasesRequiringAction.value.length) {
    // Small delay before showing next modal
    await new Promise((resolve) => setTimeout(resolve, 500))
    showVerificationModal.value = true
  } else {
    // All verifications complete
    verifying.value = false
    currentPurchaseIndex.value = 0

    // Refresh purchases to get updated status
    await appStore.getUserPurchases()
  }
}

const handleVerificationError = (error: string) => {
  console.error('Payment verification failed:', error)
  showVerificationModal.value = false
  verifying.value = false
  currentPurchaseIndex.value = 0
}

const handleVerificationClose = () => {
  showVerificationModal.value = false
  verifying.value = false
  currentPurchaseIndex.value = 0
}

onMounted(async () => {
  // Initialize Stripe
  const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  if (stripePublishableKey) {
    stripe.value = await loadStripe(stripePublishableKey)
  }
})
</script>

<style scoped>
.payment-action-alert {
  margin-bottom: var(--space-6);
}

.alert-message {
  margin: 0 0 var(--space-4) 0;
  color: var(--color-text-primary);
  line-height: var(--line-height-relaxed);
}

.verify-button {
  margin-top: var(--space-2);
}
</style>
