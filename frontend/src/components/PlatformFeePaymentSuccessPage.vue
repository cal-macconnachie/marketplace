<template>
  <div class="payment-success-page">
    <div class="payment-success-container">
      <div v-if="processing" class="processing-state">
        <LoadingSpinner :size="48" />
        <h2>Processing Payment...</h2>
        <p>Please wait while we confirm your payment.</p>
      </div>

      <div v-else-if="error" class="error-state">
        <div class="error-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        </div>
        <h2>Payment Processing Error</h2>
        <p class="error-message">{{ error }}</p>
        <p class="help-text">If you were charged, please contact support. Your payment may still be processing.</p>
        <BaseButton @click="goToDashboard" variant="primary">Go to Dashboard</BaseButton>
      </div>

      <div v-else class="success-state">
        <div class="success-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <h2>Payment Successful!</h2>
        <p class="success-message">
          Your outstanding platform fees have been paid.
          <span v-if="feesPaid">{{ feesPaid }} fee period{{ feesPaid > 1 ? 's' : '' }} settled.</span>
        </p>
        <p class="reactivation-message">
          Your account has been reactivated and you can now process transactions.
        </p>
        <BaseButton @click="goToDashboard" variant="primary">Go to Dashboard</BaseButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { publicApi } from '@/services/api'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import BaseButton from '@/components/ui/BaseButton.vue'

const route = useRoute()
const router = useRouter()

const processing = ref(true)
const error = ref<string | null>(null)
const feesPaid = ref<number>(0)

async function processPaymentSuccess() {
  try {
    processing.value = true
    error.value = null

    const sessionId = route.query.session_id as string

    if (!sessionId) {
      error.value = 'Missing payment session ID'
      processing.value = false
      return
    }

    const response = await publicApi.handleFeePaymentSuccess(sessionId)

    if (response.success) {
      feesPaid.value = response.feesPaid
      processing.value = false
    } else {
      error.value = 'Payment verification failed'
      processing.value = false
    }
  } catch (err: any) {
    console.error('Error processing payment success:', err)
    error.value = err.response?.data?.error || err.message || 'Failed to verify payment'
    processing.value = false
  }
}

function goToDashboard() {
  router.push('/dashboard')
}

onMounted(() => {
  processPaymentSuccess()
})
</script>

<style scoped>
.payment-success-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  padding: 2rem;
}

.payment-success-container {
  background: white;
  border-radius: 16px;
  padding: 3rem;
  max-width: 500px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  text-align: center;
}

.processing-state,
.error-state,
.success-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.processing-state h2,
.error-state h2,
.success-state h2 {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.processing-state p,
.error-state p,
.success-state p {
  font-size: 1rem;
  color: #6b7280;
  margin: 0;
}

.error-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #fee2e2;
  display: flex;
  align-items: center;
  justify-content: center;
}

.error-icon svg {
  stroke: #dc2626;
}

.error-message {
  color: #991b1b;
  font-weight: 500;
}

.help-text {
  font-size: 0.875rem;
  color: #9ca3af;
}

.success-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: #d1fae5;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: scaleIn 0.5s ease-out;
}

.success-icon svg {
  stroke: #059669;
}

.success-message {
  font-size: 1.125rem;
  color: #1f2937;
  font-weight: 500;
}

.reactivation-message {
  background: #d1fae5;
  color: #065f46;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
}

@keyframes scaleIn {
  from {
    transform: scale(0);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

@media (max-width: 640px) {
  .payment-success-page {
    padding: 1rem;
  }

  .payment-success-container {
    padding: 2rem 1.5rem;
  }
}
</style>
