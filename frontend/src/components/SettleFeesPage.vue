<template>
  <div class="settle-fees-page">
    <div class="settle-fees-container">
      <div v-if="loading" class="loading-state">
        <LoadingSpinner :size="48" />
        <h2>Preparing Payment...</h2>
        <p>Please wait while we prepare your payment checkout.</p>
      </div>

      <div v-else-if="error" class="error-state">
        <div class="error-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        </div>
        <h2>Payment Error</h2>
        <p class="error-message">{{ error }}</p>
        <BaseButton @click="handleRetry" variant="primary">Try Again</BaseButton>
        <BaseButton @click="goToDashboard" variant="secondary">Go to Dashboard</BaseButton>
      </div>

      <div v-else-if="noFeesOwed" class="success-state">
        <div class="success-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <h2>All Caught Up!</h2>
        <p>You have no outstanding fees to pay.</p>
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

const loading = ref(true)
const error = ref<string | null>(null)
const noFeesOwed = ref(false)

async function createPaymentCheckout() {
  try {
    loading.value = true
    error.value = null
    noFeesOwed.value = false

    const organizationId = route.query.org as string

    if (!organizationId) {
      error.value = 'Missing organization ID. Please use the link from your email.'
      loading.value = false
      return
    }

    const response = await publicApi.createFeePaymentCheckout(organizationId)

    if (response.message === 'No outstanding fees') {
      noFeesOwed.value = true
      loading.value = false
      return
    }

    if (response.checkoutUrl) {
      // Redirect to Stripe Checkout
      window.location.href = response.checkoutUrl
    } else {
      error.value = 'Failed to create payment session. Please try again.'
      loading.value = false
    }
  } catch (err: any) {
    console.error('Error creating payment checkout:', err)
    error.value = err.response?.data?.error || err.message || 'An unexpected error occurred'
    loading.value = false
  }
}

function handleRetry() {
  createPaymentCheckout()
}

function goToDashboard() {
  router.push('/dashboard')
}

onMounted(() => {
  createPaymentCheckout()
})
</script>

<style scoped>
.settle-fees-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
}

.settle-fees-container {
  background: white;
  border-radius: 16px;
  padding: 3rem;
  max-width: 500px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  text-align: center;
}

.loading-state,
.error-state,
.success-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.loading-state h2,
.error-state h2,
.success-state h2 {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.loading-state p,
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

.success-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #d1fae5;
  display: flex;
  align-items: center;
  justify-content: center;
}

.success-icon svg {
  stroke: #059669;
}

.error-state button,
.success-state button {
  margin-top: 0.5rem;
}

@media (max-width: 640px) {
  .settle-fees-page {
    padding: 1rem;
  }

  .settle-fees-container {
    padding: 2rem 1.5rem;
  }
}
</style>
