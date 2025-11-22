<template>
  <div class="payment-cancelled-page">
    <div class="payment-cancelled-container">
      <div class="cancelled-icon">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
      </div>

      <h2>Payment Cancelled</h2>

      <p class="message">
        You cancelled the payment process. Your outstanding fees have not been paid.
      </p>

      <div class="warning-box">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        <span>Your account may be suspended if fees remain unpaid.</span>
      </div>

      <p class="next-steps">
        You can return to pay your outstanding fees at any time by clicking the link in your notification email.
      </p>

      <div class="button-group">
        <BaseButton @click="goToDashboard" variant="primary">Go to Dashboard</BaseButton>
        <BaseButton @click="goToMarketplace" variant="secondary">Go to Marketplace</BaseButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import BaseButton from '@/components/ui/BaseButton.vue'

const router = useRouter()

function goToDashboard() {
  router.push('/dashboard')
}

function goToMarketplace() {
  router.push('/')
}
</script>

<style scoped>
.payment-cancelled-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  padding: 2rem;
}

.payment-cancelled-container {
  background: white;
  border-radius: 16px;
  padding: 3rem;
  max-width: 500px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.cancelled-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: #fee2e2;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cancelled-icon svg {
  stroke: #dc2626;
}

h2 {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.message {
  font-size: 1rem;
  color: #6b7280;
  margin: 0;
}

.warning-box {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #fef3c7;
  color: #92400e;
  padding: 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
}

.warning-box svg {
  flex-shrink: 0;
  stroke: #d97706;
}

.next-steps {
  font-size: 0.875rem;
  color: #6b7280;
  line-height: 1.5;
}

.button-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  margin-top: 0.5rem;
}

@media (max-width: 640px) {
  .payment-cancelled-page {
    padding: 1rem;
  }

  .payment-cancelled-container {
    padding: 2rem 1.5rem;
  }
}
</style>
