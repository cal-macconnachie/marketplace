<template>
  <div
    class="purchase-line-item"
    :class="{ expandable: hasBreakdown, expanded: showBreakdown }"
    @click="toggleBreakdown"
  >
    <div class="item-main">
      <span class="product">{{ purchase.product_name }}</span>
      <span class="amount">{{ formatMoneyInt(displayAmount, purchase.currency) }}</span>
    </div>
    <div class="item-meta">
      <span class="date">{{ formattedDate }}</span>
      <div
        class="product-badge"
        :class="{
          'product-badge--subscription':
            purchase.type === 'subscription' || purchase.type === 'metered_subscription',
          'product-badge--one-time': purchase.type === 'one_time',
        }"
      >
        <!-- Subscription recurring icon -->
        <svg
          v-if="purchase.type === 'subscription' || purchase.type === 'metered_subscription'"
          class="badge-icon"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
            clip-rule="evenodd"
          />
        </svg>
        <svg v-else class="badge-icon" viewBox="0 0 20 20" fill="currentColor">
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clip-rule="evenodd"
          />
        </svg>
        <span class="badge-text">
          {{ purchase.type === 'subscription' ? 'Subscription' : 'One-time' }}
        </span>
      </div>
      <div
        v-if="purchase.status"
        class="status-badge"
        :class="{
          'status-badge--completed': purchase.status === 'completed',
          'status-badge--pending': purchase.status === 'pending',
          'status-badge--failed': purchase.status === 'failed',
          'status-badge--metered':
            purchase.status === 'pending' && purchase.type === 'metered_subscription',
        }"
      >
        <!-- Metered subscription in billing period -->
        <svg
          v-if="purchase.status === 'pending' && purchase.type === 'metered_subscription'"
          class="status-icon"
          viewBox="0 0 20 20"
          fill="currentColor"
          title="Active billing period"
        >
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
            clip-rule="evenodd"
          />
        </svg>
        <!-- Regular pending (payment processing) -->
        <LoadingSpinner v-else-if="purchase.status === 'pending'" :size="10" />
        <svg
          v-else-if="purchase.status === 'completed'"
          class="status-icon"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clip-rule="evenodd"
          />
        </svg>
        <svg
          v-else-if="purchase.status === 'failed'"
          class="status-icon"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clip-rule="evenodd"
          />
        </svg>
      </div>
    </div>
    <div v-if="purchase.applied_discount" class="discount-info">
      <svg class="discount-icon" width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
        <path
          fill-rule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z"
          clip-rule="evenodd"
        />
      </svg>
      <span>{{ discountText }}</span>
    </div>
    <div v-if="hasBreakdown" class="breakdown" :class="{ visible: showBreakdown }">
      <div class="breakdown-header">
        <BaseButton
          variant="ghost"
          size="xs"
          class="info-button"
          @click.stop="showDetailsDrawer = true"
          aria-label="View purchase details"
          title="View details"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path
              fill-rule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clip-rule="evenodd"
            />
          </svg>
        </BaseButton>
      </div>
      <div class="breakdown-row">
        <span>{{ purchase.applied_discount ? 'Original Price' : 'Subtotal' }}</span>
        <span>{{ formatMoneyInt(originalAmount, purchase.currency) }}</span>
      </div>
      <div v-if="purchase.applied_discount" class="breakdown-row discount">
        <span
          >Discount{{
            purchase.applied_discount.code ? ` (${purchase.applied_discount.code})` : ''
          }}</span
        >
        <span>{{ discountAmount }}</span>
      </div>
      <div v-if="purchase.applied_discount" class="breakdown-row">
        <span>Subtotal</span>
        <span>{{ formatMoneyInt(purchase.base_amount ?? 0, purchase.currency) }}</span>
      </div>
      <div v-if="purchase.tax_amount && purchase.tax_amount > 0" class="breakdown-row">
        <span>Tax</span>
        <span>{{ formatMoneyInt(purchase.tax_amount, purchase.currency) }}</span>
      </div>
      <div v-if="viewerType === 'purchaser'" class="breakdown-row total">
        <span>Total</span>
        <span>{{ formatMoneyInt(displayTotal, purchase.currency) }}</span>
      </div>
      <div
        v-if="
          viewerType === 'seller' &&
          purchase.platform_fee_amount &&
          purchase.platform_fee_amount > 0
        "
        class="breakdown-row platform-fee"
      >
        <span>Platform Fee</span>
        <span>-{{ formatMoneyInt(purchase.platform_fee_amount, purchase.currency) }}</span>
      </div>
      <div v-if="viewerType === 'seller'" class="breakdown-row total">
        <span>You {{ purchase.status === 'completed' ? 'Received' : 'Will Receive' }}</span>
        <span>{{ formatMoneyInt(displayTotal, purchase.currency) }}</span>
      </div>
      <div
        v-if="
          viewerType === 'seller' &&
          purchase.type === 'metered_subscription' &&
          purchase.status === 'pending'
        "
        class="meter-actions"
      >
        <div class="meter-input-group" @click.stop>
          <QuantitySelector v-model="meterValue" :min="1" :max="9999" size="sm" />
          <BaseButton
            size="sm"
            variant="primary"
            :loading="isLoggingMeter"
            :disabled="!meterValue || meterValue <= 0"
            confirm-dialogue="Confirm"
            @click="logMeterEvent"
          >
            Log Usage
          </BaseButton>
        </div>
        <p v-if="meterError" class="meter-error">{{ meterError }}</p>
        <p v-if="meterSuccess" class="meter-success">{{ meterSuccess }}</p>
      </div>
    </div>

    <!-- Purchase Details Drawer -->
    <PurchaseDetailsDrawer
      :show="showDetailsDrawer"
      :purchase="purchase"
      :viewer-type="viewerType"
      @close="showDetailsDrawer = false"
    />
  </div>
</template>

<script setup lang="ts">
import { authAPI } from '@/services/api'
import { useAppStore } from '@/stores/app'
import type { Purchase } from '@marketplace/types'
import { computed, defineProps, onMounted, onUnmounted, ref } from 'vue'
import BaseButton from './BaseButton.vue'
import LoadingSpinner from './LoadingSpinner.vue'
import PurchaseDetailsDrawer from './PurchaseDetailsDrawer.vue'
import QuantitySelector from './QuantitySeletor.vue'

const { purchase, viewerType = 'purchaser' } = defineProps<{
  purchase: Purchase
  viewerType?: 'purchaser' | 'seller'
}>()

const showBreakdown = ref(false)
const showDetailsDrawer = ref(false)
let pollInterval: ReturnType<typeof setInterval> | null = null
const app = useAppStore()
const meterValue = ref<number>(1)
const isLoggingMeter = ref(false)
const meterError = ref<string>('')
const meterSuccess = ref<string>('')

const formattedDate = computed(() => {
  const date = new Date(purchase.purchased_at)
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
})

const hasBreakdown = computed(() => {
  return (
    purchase.base_amount !== undefined ||
    purchase.tax_amount !== undefined ||
    purchase.platform_fee_amount !== undefined ||
    (viewerType === 'seller' &&
      purchase.type === 'metered_subscription' &&
      purchase.status === 'pending')
  )
})

const displayAmount = computed(() => {
  // Sellers see the amount they received (total minus platform fee)
  if (viewerType === 'seller') {
    return purchase.amount - (purchase.platform_fee_amount || 0)
  }
  // Purchasers see the full amount they paid
  return purchase.amount
})

const displayTotal = computed(() => {
  // In breakdown, sellers see what they received, purchasers see what they paid
  return displayAmount.value
})

const discountText = computed(() => {
  if (!purchase.applied_discount) return ''

  const { type, code, coupon } = purchase.applied_discount

  if (type === 'promotion_code' && code) {
    return `Promo code applied: ${code}`
  }

  if (type === 'coupon' && coupon) {
    if (coupon.percent_off) {
      return `Coupon applied: ${coupon.percent_off}% off`
    }
    if (coupon.amount_off) {
      return `Coupon applied: ${formatMoneyInt(coupon.amount_off, purchase.currency)} off`
    }
  }

  return 'Discount applied'
})

const originalAmount = computed(() => {
  if (!purchase.applied_discount?.coupon || !purchase.base_amount) return purchase.base_amount ?? 0

  const { coupon } = purchase.applied_discount

  if (coupon.amount_off) {
    // If fixed amount discount, add it back
    return purchase.base_amount + coupon.amount_off
  }

  if (coupon.percent_off) {
    // If percentage discount, reverse calculate: base_amount = original * (1 - percent/100)
    // So: original = base_amount / (1 - percent/100)
    return Math.round(purchase.base_amount / (1 - coupon.percent_off / 100))
  }

  return purchase.base_amount
})

const discountAmount = computed(() => {
  if (!purchase.applied_discount?.coupon) return ''

  const discountValue = originalAmount.value - (purchase.base_amount ?? 0)
  return `-${formatMoneyInt(discountValue, purchase.currency)}`
})

function toggleBreakdown() {
  if (hasBreakdown.value) {
    showBreakdown.value = !showBreakdown.value
  }
}

function formatMoneyInt(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount / 100)
}

async function checkPurchaseStatus() {
  if (purchase.status !== 'pending') return

  try {
    const result = await authAPI.getPurchases({
      purchase: {
        id: purchase.id,
        user_id: purchase.user_id,
      },
      limit: 1,
    })

    // Handle different response formats
    let updatedPurchase: Purchase | null = null
    if (result && 'items' in result && result.items.length > 0) {
      updatedPurchase = result.items[0]
    } else if (result && 'id' in result) {
      updatedPurchase = result as Purchase
    }

    if (!updatedPurchase) return

    // Check if status has changed
    if (updatedPurchase.status !== purchase.status) {
      // Update directly in store based on viewer type
      if (viewerType === 'purchaser') {
        app.updateUserPurchase(updatedPurchase)
      } else if (viewerType === 'seller') {
        app.updateOrganizationPurchase(updatedPurchase)
      }

      // Stop polling if no longer pending (check the actual status value)
      if (updatedPurchase.status === 'completed' || updatedPurchase.status === 'failed') {
        stopPolling()
      }
    } else {
      // Check if purchase has been pending for over an hour
      if (purchase.type === 'metered_subscription') {
        // Don't auto-fail metered subscriptions as they may take time to finalize
        return
      }
      const purchasedAt = new Date(purchase.purchased_at).getTime()
      const now = Date.now()
      const oneHourInMs = 60 * 60 * 1000

      if (now - purchasedAt > oneHourInMs && purchase.status === 'pending') {
        // Update purchase status to failed
        const failedPurchase = { ...purchase, status: 'failed' as const }

        // Call API to update the purchase in the database
        await authAPI.getPurchases({
          purchase: {
            id: purchase.id,
            user_id: purchase.user_id,
            status: 'failed',
          },
          type: 'update',
          limit: 1,
        })

        // Update directly in store based on viewer type
        if (viewerType === 'purchaser') {
          app.updateUserPurchase(failedPurchase)
        } else if (viewerType === 'seller') {
          app.updateOrganizationPurchase(failedPurchase)
        }
        stopPolling()
      }
    }
  } catch (error) {
    console.error('Failed to check purchase status:', error)
  }
}

function startPolling() {
  // Poll every 5 seconds for pending purchases except metered subscriptions
  if (purchase.type === 'metered_subscription') return
  if (purchase.status === 'pending' && !pollInterval) {
    // Check immediately on mount
    checkPurchaseStatus()

    // Then poll every 5 seconds
    pollInterval = setInterval(checkPurchaseStatus, 5000)
  }
}

async function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
    // Refetch organization data and subscription products to get updated info
    await Promise.all([app.fetchOrganization(), app.fetchSubscriptionPurchasedProducts()])
  }
}

async function logMeterEvent() {
  if (!meterValue.value || meterValue.value <= 0) return

  isLoggingMeter.value = true
  meterError.value = ''
  meterSuccess.value = ''

  try {
    await authAPI.logMeterEvent({
      purchase_id: purchase.id,
      user_id: purchase.user_id,
      value: meterValue.value,
      metadata: undefined,
    })

    meterSuccess.value = `Logged ${meterValue.value} usage event(s)`
    meterValue.value = 1

    // Clear success message after 3 seconds
    setTimeout(() => {
      meterSuccess.value = ''
    }, 3000)
  } catch (error) {
    console.error('Failed to log meter event:', error)
    meterError.value = 'Failed to log usage event. Please try again.'
  } finally {
    isLoggingMeter.value = false
  }
}

onMounted(() => {
  startPolling()
})

onUnmounted(() => {
  stopPolling()
})
</script>

<style scoped>
.purchase-line-item {
  display: flex;
  flex-direction: column;
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-primary);
  transition: all 0.2s ease;
  margin: var(--space-4) 0;
}

.purchase-line-item.expandable {
  cursor: pointer;
}

.purchase-line-item.expanded {
  padding-bottom: 0;
}

.item-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  font-weight: var(--font-weight-medium);
}

.amount {
  color: var(--color-primary);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}
.product {
  color: var(--color-text-primary);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}
.date {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}
.item-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-top: var(--space-1);
}
.product-badge {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 6px;
  margin-left: auto;
  border-radius: var(--radius-full);
  font-size: 10px;
  font-weight: var(--font-weight-medium);
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.product-badge--subscription {
  background: var(--color-subscription-bg);
  color: var(--color-subscription);
  border: 1px solid var(--color-subscription-border);
}

.product-badge--one-time {
  background: var(--color-onetime-bg);
  color: var(--color-onetime);
  border: 1px solid var(--color-onetime-border);
}

.badge-icon {
  flex-shrink: 0;
  width: 10px;
  height: 10px;
}

.badge-text {
  font-size: 10px;
  line-height: 1;
}

.status-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px 6px;
  border-radius: var(--radius-full);
}

.status-badge--completed {
  background: rgba(34, 197, 94, 0.1);
  color: rgb(34, 197, 94);
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.status-badge--pending {
  background: rgba(59, 130, 246, 0.15);
  color: rgb(37, 99, 235);
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.status-badge--metered {
  background: var(--color-metered-bg);
  color: var(--color-metered);
  border: 1px solid var(--color-metered-border);
}

.status-badge--failed {
  background: rgba(239, 68, 68, 0.1);
  color: rgb(239, 68, 68);
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.status-icon {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
}

.discount-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: rgba(34, 197, 94, 0.05);
  border-left: 2px solid rgb(34, 197, 94);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  color: rgb(34, 197, 94);
}

.discount-icon {
  flex-shrink: 0;
}

.breakdown {
  margin-top: var(--space-4);
  padding-top: 0;
  padding-bottom: 0;
  background: var(--color-bg-muted);
  margin-left: calc(-1 * var(--space-4));
  margin-right: calc(-1 * var(--space-4));
  padding-left: var(--space-4);
  padding-right: var(--space-4);
  border-radius: var(--radius-md);
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  transition: all 0.3s ease;
}

.breakdown.visible {
  max-height: 300px;
  opacity: 1;
  padding-top: var(--space-3);
  padding-bottom: var(--space-3);
}

.breakdown-header {
  display: flex;
  justify-content: flex-start;
  margin-bottom: var(--space-2);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--color-border);
}

.breakdown .info-button {
  border: 1px solid var(--color-border);
}

.breakdown .info-button:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
  background: var(--color-bg-primary);
}

.breakdown-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-1) 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.breakdown-row.discount {
  color: rgb(34, 197, 94);
}

.breakdown-row.platform-fee {
  color: var(--color-text-muted);
}

.breakdown-row.platform-fee span:last-child {
  color: rgb(239, 68, 68);
}

.breakdown-row.total {
  border-top: 1px solid var(--color-border);
  margin-top: var(--space-2);
  padding-top: var(--space-2);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
}

.payment-method {
  font-style: italic;
}

.meter-actions {
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}

.meter-input-group {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  width: 100%;
}

.meter-input-group :deep(.quantity-input),
.meter-input-group :deep(.quantity-input-wrapper) {
  flex: 1;
}

.meter-error {
  margin-top: var(--space-2);
  font-size: var(--font-size-sm);
  color: rgb(239, 68, 68);
  margin-bottom: 0;
}

.meter-success {
  margin-top: var(--space-2);
  font-size: var(--font-size-sm);
  color: rgb(34, 197, 94);
  margin-bottom: 0;
}
</style>
