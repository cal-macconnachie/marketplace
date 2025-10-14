<template>
  <BaseModal
    :show="show"
    title="Dispute Purchases"
    size="lg"
    variant="drawer"
    @close="$emit('close')"
  >
    <div v-if="isLoading" class="loading-state">
      <LoadingSpinner :size="32" />
      <p>Loading purchases...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <BaseAlert variant="error" :show="true">
        {{ error }}
      </BaseAlert>
    </div>

    <div v-else-if="purchases.length > 0" class="dispute-content">
      <!-- Receipt Number -->
      <section class="receipt-info">
        <div class="receipt-number">
          <span class="receipt-label">Receipt #</span>
          <span class="receipt-value">{{ cartId }}</span>
        </div>
        <p>Select the purchases you wish to dispute. You can dispute multiple items from this order at once.</p>
      </section>

      <!-- Purchase Selection List -->
      <section class="purchase-list">
        <div
          v-for="purchase in purchases"
          :key="purchase.id"
          class="purchase-item"
          :class="{ selected: selectedPurchaseIds.has(purchase.id) }"
          @click="togglePurchaseSelection(purchase.id)"
        >
          <div class="checkbox-wrapper">
            <div
              class="custom-checkbox"
              :class="{ checked: selectedPurchaseIds.has(purchase.id) }"
              @click.stop="togglePurchaseSelection(purchase.id)"
            >
              <svg
                v-if="selectedPurchaseIds.has(purchase.id)"
                class="check-icon"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M13.5 4L6 11.5L2.5 8"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
          </div>
          <div class="purchase-details">
            <div class="purchase-header">
              <h6 class="purchase-name">{{ purchase.product_name }}</h6>
              <span class="purchase-amount">{{ formatMoneyInt(purchase.amount, purchase.currency) }}</span>
            </div>
            <div class="purchase-meta">
              <span class="purchase-date">{{ formatDate(purchase.purchased_at) }}</span>
              <span
                v-if="purchase.type === 'subscription' || purchase.type === 'metered_subscription'"
                class="purchase-type-badge subscription"
              >
                Subscription
              </span>
              <span v-else class="purchase-type-badge one-time">One-time</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Dispute Reason -->
      <section class="dispute-reason-section">
        <label for="dispute-reason" class="reason-label">Reason for dispute *</label>
        <textarea
          id="dispute-reason"
          v-model="disputeReason"
          class="reason-textarea"
          placeholder="Please provide details about why you're disputing these purchases..."
          rows="4"
        ></textarea>
      </section>

      <!-- Summary -->
      <section v-if="selectedPurchaseIds.size > 0" class="dispute-summary">
        <div class="summary-row">
          <span class="summary-label">Items selected:</span>
          <span class="summary-value">{{ selectedPurchaseIds.size }}</span>
        </div>
        <div class="summary-row summary-total">
          <span class="summary-label">Total amount:</span>
          <span class="summary-value">{{ totalDisputeAmount }}</span>
        </div>
      </section>

      <!-- Actions -->
      <div class="dispute-actions">
        <BaseButton
          variant="outline"
          @click="$emit('close')"
          :disabled="isSubmitting"
        >
          Cancel
        </BaseButton>
        <BaseButton
          variant="primary"
          @click="submitDispute"
          :loading="isSubmitting"
          :disabled="selectedPurchaseIds.size === 0 || !disputeReason.trim()"
        >
          Submit Dispute
        </BaseButton>
      </div>

      <!-- Success Message -->
      <BaseAlert
        v-if="submitSuccess"
        variant="success"
        :show="true"
        dismissible
        @dismiss="submitSuccess = false"
      >
        Dispute submitted successfully. We'll review your request and contact you shortly.
      </BaseAlert>
    </div>

    <div v-else class="empty-state">
      <p>No purchases found for this order.</p>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { authAPI } from '@/services/api'
import { useDisputeStore } from '@/stores/disputes'
import type { Purchase } from '@marketplace/types'
import { computed, ref, watch } from 'vue'
import BaseAlert from './BaseAlert.vue'
import BaseButton from './BaseButton.vue'
import BaseModal from './BaseModal.vue'
import LoadingSpinner from './LoadingSpinner.vue'

interface Props {
  show: boolean
  cartId: string
  userId: string
  initialPurchaseId?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  disputeCreated: []
}>()

const disputeStore = useDisputeStore()

const isLoading = ref(false)
const error = ref<string>('')
const purchases = ref<Purchase[]>([])
const selectedPurchaseIds = ref<Set<string>>(new Set())
const disputeReason = ref<string>('')
const isSubmitting = ref(false)
const submitSuccess = ref(false)

// Computed total amount for selected purchases
const totalDisputeAmount = computed(() => {
  const total = Array.from(selectedPurchaseIds.value).reduce((sum, purchaseId) => {
    const purchase = purchases.value.find(p => p.id === purchaseId)
    return sum + (purchase?.amount || 0)
  }, 0)

  const currency = purchases.value[0]?.currency || 'USD'
  return formatMoneyInt(total, currency)
})

async function loadPurchases() {
  if (!props.cartId || !props.userId) {
    error.value = 'Missing cart or user information'
    return
  }

  try {
    isLoading.value = true
    error.value = ''

    // Fetch all purchases for this cart
    const response = await authAPI.getPurchases({
      purchase: {
        cart_id: props.cartId,
        user_id: props.userId
      },
      limit: 100
    })

    if (response && 'items' in response) {
      purchases.value = response.items
    } else if (Array.isArray(response)) {
      purchases.value = response
    } else {
      purchases.value = []
    }

    // Pre-select the initial purchase if provided
    if (props.initialPurchaseId) {
      selectedPurchaseIds.value.add(props.initialPurchaseId)
    }
  } catch (err) {
    console.error('Failed to load purchases:', err)
    error.value = 'Failed to load purchases for this order'
  } finally {
    isLoading.value = false
  }
}

function togglePurchaseSelection(purchaseId: string) {
  if (selectedPurchaseIds.value.has(purchaseId)) {
    selectedPurchaseIds.value.delete(purchaseId)
  } else {
    selectedPurchaseIds.value.add(purchaseId)
  }
}

async function submitDispute() {
  if (selectedPurchaseIds.value.size === 0) return
  if (!disputeReason.value.trim()) {
    error.value = 'Please provide a reason for the dispute'
    return
  }

  try {
    isSubmitting.value = true
    submitSuccess.value = false
    error.value = ''

    // Create dispute via API
    await disputeStore.createDispute({
      cart_id: props.cartId,
      purchase_ids: Array.from(selectedPurchaseIds.value),
      reason: disputeReason.value.trim()
    })

    submitSuccess.value = true

    // Emit success event
    emit('disputeCreated')

    // Reset form after 2 seconds and close
    setTimeout(() => {
      resetForm()
      emit('close')
    }, 2000)
  } catch (err) {
    console.error('Failed to submit dispute:', err)
    error.value = err instanceof Error ? err.message : 'Failed to submit dispute. Please try again.'
  } finally {
    isSubmitting.value = false
  }
}

function resetForm() {
  selectedPurchaseIds.value.clear()
  disputeReason.value = ''
  submitSuccess.value = false
  error.value = ''
}

function formatMoneyInt(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount / 100)
}

function formatDate(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

watch(() => props.show, (newShow) => {
  if (newShow) {
    loadPurchases()
  } else {
    // Reset state when drawer closes
    resetForm()
    purchases.value = []
  }
})
</script>

<style scoped>
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  padding: var(--space-8);
  color: var(--color-text-secondary);
}

.error-state {
  padding: var(--space-4);
}

.empty-state {
  padding: var(--space-8);
  text-align: center;
  color: var(--color-text-secondary);
}

.dispute-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

/* Receipt Info */
.receipt-info {
  padding: var(--space-4);
  background: var(--color-bg-muted);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.receipt-number {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.receipt-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.receipt-value {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}

/* Purchase List */
.purchase-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.purchase-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-bg-primary);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
}

.purchase-item:hover {
  border-color: var(--color-primary);
  background: var(--color-bg-muted);
}

.purchase-item.selected {
  border-color: var(--color-primary);
  background: rgba(59, 130, 246, 0.05);
}

.checkbox-wrapper {
  flex-shrink: 0;
  padding-top: 2px;
}

.custom-checkbox {
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.custom-checkbox:hover {
  border-color: var(--color-primary);
  background: var(--color-bg-muted);
}

.custom-checkbox.checked {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.check-icon {
  width: 14px;
  height: 14px;
  color: white;
}

.purchase-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.purchase-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
}

.purchase-name {
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.purchase-amount {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-primary);
  white-space: nowrap;
}

.purchase-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.purchase-date {
  color: var(--color-text-secondary);
}

.purchase-type-badge {
  padding: 2px 6px;
  border-radius: var(--radius-full);
  font-size: 10px;
  font-weight: var(--font-weight-medium);
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.purchase-type-badge.subscription {
  background: var(--color-subscription-bg);
  color: var(--color-subscription);
  border: 1px solid var(--color-subscription-border);
}

.purchase-type-badge.one-time {
  background: var(--color-onetime-bg);
  color: var(--color-onetime);
  border: 1px solid var(--color-onetime-border);
}

/* Dispute Reason */
.dispute-reason-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.reason-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.reason-textarea {
  width: 100%;
  padding: var(--space-3);
  font-size: var(--font-size-sm);
  font-family: inherit;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  resize: vertical;
  min-height: 80px;
}

.reason-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.reason-textarea::placeholder {
  color: var(--color-text-muted);
}

/* Summary */
.dispute-summary {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
  background: var(--color-bg-muted);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-2) 0;
}

.summary-row.summary-total {
  padding-top: var(--space-3);
  margin-top: var(--space-2);
  border-top: 2px solid var(--color-border);
}

.summary-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.summary-row.summary-total .summary-label {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.summary-value {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.summary-row.summary-total .summary-value {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-primary);
}

/* Actions */
.dispute-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

/* Responsive */
@media (max-width: 640px) {
  .purchase-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }

  .purchase-amount {
    font-size: var(--font-size-lg);
  }

  .dispute-actions {
    flex-direction: column-reverse;
  }

  .dispute-actions button {
    width: 100%;
  }
}
</style>
