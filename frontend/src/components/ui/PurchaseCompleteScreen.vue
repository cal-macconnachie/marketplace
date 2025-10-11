<template>
  <div class="purchase-complete">
    <div class="success-animation">
      <div class="checkmark-circle">
        <svg
          class="checkmark"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 52 52"
        >
          <circle class="checkmark-circle-bg" cx="26" cy="26" r="25" fill="none" />
          <path class="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
        </svg>
      </div>
    </div>

    <h1 class="title">Thank You for Your Purchase!</h1>
    <p class="message">{{ message }}</p>

    <div class="order-details" v-if="orderSummary">
      <div class="detail-item">
        <span class="detail-label">Order Total:</span>
        <span class="detail-value">
          <div v-for="(amount, currency) in orderSummary.totals" :key="currency">
            <PriceDisplay :amount="amount" :currency="currency" size="md" />
          </div>
        </span>
      </div>
      <div class="detail-item" v-if="orderSummary.hasSubscriptions">
        <span class="detail-label">Subscription Status:</span>
        <span class="detail-value">Active</span>
      </div>
    </div>

    <div class="actions">
      <BaseButton
        v-if="showReferrerOption"
        @click="handleGoToReferrer"
        variant="primary"
        size="lg"
        full-width
      >
        {{ referrerLabel }}
      </BaseButton>
      <BaseButton
        @click="handleGoToAccount"
        variant="outline"
        size="lg"
        full-width
      >
        Go to My Account
      </BaseButton>
    </div>

    <div class="additional-info">
      <p>A confirmation email has been sent with your order details.</p>
      <p v-if="orderSummary?.hasSubscriptions">
        You can manage your subscriptions from your account dashboard.
      </p>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import BaseButton from './BaseButton.vue'
import PriceDisplay from './PriceDisplay.vue'

interface OrderSummary {
  totals: Record<string, number>
  hasSubscriptions: boolean
}

interface Props {
  message: string
  referrer?: string
  orderSummary?: OrderSummary
}

const props = withDefaults(defineProps<Props>(), {
  message: 'Your order has been processed successfully.',
  referrer: undefined,
  orderSummary: undefined,
})

const router = useRouter()

const showReferrerOption = computed(() => {
  return !!props.referrer
})

const referrerLabel = computed(() => {
  if (!props.referrer) return 'Back to Store'

  try {
    // If referrer is a full URL, extract hostname
    if (props.referrer.startsWith('http://') || props.referrer.startsWith('https://')) {
      const url = new URL(props.referrer)
      return `Back to ${url.hostname}`
    }
    // If it's already just a hostname
    return `Back to ${props.referrer}`
  } catch {
    return 'Back to Store'
  }
})

const handleGoToReferrer = () => {
  if (!props.referrer) return

  try {
    // If referrer is already a full URL, use it directly
    if (props.referrer.startsWith('http://') || props.referrer.startsWith('https://')) {
      window.location.href = props.referrer
    } else {
      // If it's just a hostname, add https://
      window.location.href = `https://${props.referrer}`
    }
  } catch (error) {
    console.error('Failed to navigate to referrer:', error)
    // Fallback to marketplace
    router.push('/')
  }
}

const handleGoToAccount = () => {
  router.push('/account')
}
</script>

<style scoped>
.purchase-complete {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  max-width: 600px;
  margin: 0 auto;
  padding: var(--space-8) var(--space-4);
  text-align: center;
}

/* Success Animation */
.success-animation {
  margin-bottom: var(--space-8);
}

.checkmark-circle {
  width: 120px;
  height: 120px;
  position: relative;
  display: inline-block;
  animation: scale-up 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.checkmark {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  display: block;
  stroke-width: 3;
  stroke: var(--color-success, #22c55e);
  stroke-miterlimit: 10;
  box-shadow: inset 0px 0px 0px var(--color-success, #22c55e);
  animation: fill-success 0.4s ease-in-out 0.4s forwards;
}

.checkmark-circle-bg {
  stroke-dasharray: 166;
  stroke-dashoffset: 166;
  stroke-width: 3;
  stroke-miterlimit: 10;
  stroke: var(--color-success, #22c55e);
  animation: stroke-circle 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
}

.checkmark-check {
  transform-origin: 50% 50%;
  stroke-dasharray: 48;
  stroke-dashoffset: 48;
  stroke-width: 3;
  stroke: var(--color-success, #22c55e);
  animation: stroke-check 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards;
}

@keyframes scale-up {
  0% {
    transform: scale(0);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes stroke-circle {
  100% {
    stroke-dashoffset: 0;
  }
}

@keyframes stroke-check {
  100% {
    stroke-dashoffset: 0;
  }
}

@keyframes fill-success {
  100% {
    box-shadow: inset 0px 0px 0px 60px var(--color-success-bg, rgba(34, 197, 94, 0.1));
  }
}

/* Content */
.title {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-4) 0;
}

.message {
  font-size: var(--font-size-lg);
  color: var(--color-text-secondary);
  margin: 0 0 var(--space-8) 0;
  line-height: var(--line-height-relaxed);
}

/* Order Details */
.order-details {
  width: 100%;
  background: var(--color-bg-secondary, #f8fafc);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-6);
  margin-bottom: var(--space-8);
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) 0;
}

.detail-item:not(:last-child) {
  border-bottom: 1px solid var(--color-border);
}

.detail-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
}

.detail-value {
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  font-weight: var(--font-weight-semibold);
}

/* Actions */
.actions {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-bottom: var(--space-6);
}

/* Additional Info */
.additional-info {
  width: 100%;
}

.additional-info p {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: var(--space-2) 0;
  line-height: var(--line-height-relaxed);
}

/* Responsive */
@media (max-width: 640px) {
  .purchase-complete {
    padding: var(--space-6) var(--space-3);
  }

  .checkmark-circle {
    width: 100px;
    height: 100px;
  }

  .checkmark {
    width: 100px;
    height: 100px;
  }

  .title {
    font-size: var(--font-size-2xl);
  }

  .message {
    font-size: var(--font-size-base);
  }
}

@media (prefers-reduced-motion: reduce) {
  .checkmark-circle,
  .checkmark,
  .checkmark-circle-bg,
  .checkmark-check {
    animation: none;
  }

  .checkmark-circle-bg {
    stroke-dashoffset: 0;
  }

  .checkmark-check {
    stroke-dashoffset: 0;
  }

  .checkmark {
    box-shadow: inset 0px 0px 0px 60px var(--color-success-bg, rgba(34, 197, 94, 0.1));
  }
}
</style>
