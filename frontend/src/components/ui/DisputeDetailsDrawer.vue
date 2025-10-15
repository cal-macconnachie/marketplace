<template>
  <BaseModal
    :show="show"
    :title="drawerTitle"
    size="lg"
    variant="drawer"
    @close="$emit('close')"
  >
    <div v-if="isLoading" class="loading-state">
      <LoadingSpinner :size="32" />
      <p>Loading dispute details...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <BaseAlert variant="error" :show="true">
        {{ error }}
      </BaseAlert>
    </div>

    <div v-else-if="dispute" class="dispute-details">
      <!-- Dispute Header -->
      <section class="dispute-header">
        <div class="dispute-meta">
          <h3 class="dispute-id">Dispute #{{ dispute.id.substring(0, 8) }}</h3>
          <span class="status-badge" :class="`status-${dispute.status}`">
            {{ formatStatus(dispute.status) }}
          </span>
        </div>
        <p class="dispute-date">Filed on {{ formatDate(dispute.created_at) }}</p>
      </section>

      <!-- Dispute Reason -->
      <section class="details-section">
        <h4 class="section-title">Dispute Reason</h4>
        <p class="dispute-reason">{{ dispute.reason }}</p>
      </section>

      <!-- Purchases Being Disputed -->
      <section class="details-section">
        <h4 class="section-title">Items Being Disputed</h4>

        <div v-if="purchases.length === 0" class="empty-state">
          <p>Loading purchase details...</p>
        </div>

        <div v-else class="purchase-list">
          <div
            v-for="purchase in purchases"
            :key="purchase.id"
            class="purchase-item"
          >
            <div class="item-header">
              <h6 class="item-name">{{ purchase.product_name }}</h6>
              <span v-if="purchase.type === 'subscription' || purchase.type === 'metered_subscription'" class="subscription-badge">
                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
                </svg>
                Subscription
              </span>
            </div>

            <div class="item-details">
              <div class="detail-row">
                <span class="detail-label">Amount:</span>
                <span class="detail-value">{{ formatMoneyInt(purchase.amount, purchase.currency) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Date:</span>
                <span class="detail-value">{{ formatDate(purchase.purchased_at) }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Refund Summary -->
      <section class="details-section refund-summary">
        <h4 class="section-title">Refund Summary</h4>
        <div class="summary-breakdown">
          <div class="summary-row">
            <span class="summary-label">Total Disputed Amount</span>
            <span class="summary-value">{{ formatMoneyInt(dispute.total_dispute_amount, dispute.currency) }}</span>
          </div>
          <div class="summary-row summary-total">
            <span class="summary-label">Amount to be Refunded</span>
            <span class="summary-value">{{ formatMoneyInt(dispute.total_dispute_amount, dispute.currency) }}</span>
          </div>
        </div>
        <p class="refund-notice">
          If you accept this dispute, the full amount will be automatically refunded to the customer's original payment method.
        </p>
      </section>

      <!-- Seller Response (if exists) -->
      <section v-if="dispute.seller_response" class="details-section">
        <h4 class="section-title">Your Response</h4>
        <div class="response-box">
          <p class="response-text">{{ dispute.seller_response }}</p>
          <p class="response-date">Responded on {{ formatDate(dispute.seller_responded_at!) }}</p>
        </div>
      </section>

      <!-- Action Buttons -->
      <section v-if="dispute.status === 'pending' && action" class="action-section">
        <BaseButton
          variant="outline"
          size="lg"
          fullWidth
          @click="$emit('close')"
        >
          Cancel
        </BaseButton>
        <BaseButton
          :variant="action === 'accept' ? 'primary' : 'danger'"
          size="lg"
          fullWidth
          @click="handleAction"
        >
          {{ action === 'accept' ? 'Confirm & Refund' : 'Confirm Rejection' }}
        </BaseButton>
      </section>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { authAPI } from '@/services/api'
import type { Dispute, Purchase } from '@marketplace/types'
import { computed, ref, watch } from 'vue'
import BaseAlert from './BaseAlert.vue'
import BaseButton from './BaseButton.vue'
import BaseModal from './BaseModal.vue'
import LoadingSpinner from './LoadingSpinner.vue'

interface Props {
  show: boolean
  dispute: Dispute | null
  action?: 'accept' | 'reject'
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  confirm: [action: 'accept' | 'reject']
}>()

const isLoading = ref(false)
const error = ref<string>('')
const purchases = ref<Purchase[]>([])

const drawerTitle = computed(() => {
  if (!props.action) return 'Dispute Details'
  return props.action === 'accept' ? 'Accept Dispute & Refund' : 'Reject Dispute'
})

async function loadPurchases() {
  if (!props.dispute || props.dispute.purchase_ids.length === 0) {
    purchases.value = []
    return
  }

  try {
    isLoading.value = true
    error.value = ''

    // Fetch all purchases in the dispute
    // When doing a GET with id + user_id, the API returns a single Purchase object
    const purchasePromises = props.dispute.purchase_ids.map(id =>
      authAPI.getPurchases({ purchase: { id, user_id: props.dispute?.buyer_user_id } })
    )

    const responses = await Promise.all(purchasePromises)
    purchases.value = responses.filter((p): p is Purchase => p !== undefined && p !== null)
  } catch (err) {
    console.error('Failed to load purchases:', err)
    error.value = 'Failed to load purchase details'
  } finally {
    isLoading.value = false
  }
}

function handleAction() {
  if (props.action) {
    emit('confirm', props.action)
  }
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

function formatStatus(status: Dispute['status']): string {
  const statusMap: Record<Dispute['status'], string> = {
    pending: 'Pending',
    accepted: 'Accepted',
    rejected: 'Rejected',
    escalated: 'Escalated',
    resolved: 'Resolved'
  }
  return statusMap[status] || status
}

watch(() => props.show, (newShow) => {
  if (newShow && props.dispute) {
    loadPurchases()
  } else {
    purchases.value = []
    error.value = ''
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

.dispute-details {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

/* Dispute Header */
.dispute-header {
  padding-bottom: var(--space-4);
  border-bottom: 2px solid var(--color-border);
}

.dispute-meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-2);
}

.dispute-id {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  font-family: var(--font-family-mono);
  color: var(--color-text-primary);
}

.status-badge {
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.status-badge.status-pending {
  background: var(--color-warning-bg);
  color: var(--color-warning);
  border: 1px solid var(--color-warning-border);
}

.status-badge.status-accepted {
  background: var(--color-success-bg);
  color: var(--color-success);
  border: 1px solid var(--color-success-border);
}

.status-badge.status-escalated {
  background: var(--color-error-bg);
  color: var(--color-error);
  border: 1px solid var(--color-error-border);
}

.status-badge.status-resolved {
  background: var(--color-info-bg);
  color: var(--color-info);
  border: 1px solid var(--color-info-border);
}

.dispute-date {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

/* Section Styles */
.details-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.section-title {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--color-border);
}

/* Dispute Reason */
.dispute-reason {
  margin: 0;
  padding: var(--space-4);
  background: var(--color-bg-muted);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  line-height: var(--line-height-relaxed);
  white-space: pre-wrap;
}

/* Purchase List */
.empty-state {
  padding: var(--space-6);
  text-align: center;
  color: var(--color-text-secondary);
}

.purchase-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.purchase-item {
  padding: var(--space-4);
  background: var(--color-bg-muted);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.item-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.item-name {
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.subscription-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: var(--color-subscription-bg);
  color: var(--color-subscription);
  border: 1px solid var(--color-subscription-border);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

.metered-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: var(--color-metered-bg);
  color: var(--color-metered);
  border: 1px solid var(--color-metered-border);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

.subscription-badge svg,
.metered-badge svg {
  flex-shrink: 0;
}

.item-description {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-relaxed);
}

.item-details {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--color-bg-primary);
  border-radius: var(--radius-sm);
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  font-size: var(--font-size-sm);
}

.detail-label {
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.detail-value {
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  text-align: right;
}

.detail-value.mono {
  font-family: var(--font-family-mono);
  font-size: var(--font-size-xs);
}

/* Refund Summary */
.refund-summary {
  background: var(--color-bg-muted);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
}

.summary-breakdown {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
  background: var(--color-bg-primary);
  border-radius: var(--radius-md);
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
  color: var(--color-error);
}

.refund-notice {
  margin: var(--space-3) 0 0 0;
  padding: var(--space-3);
  background: var(--color-warning-bg);
  border: 1px solid var(--color-warning-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  line-height: var(--line-height-relaxed);
}

/* Response Box */
.response-box {
  padding: var(--space-4);
  background: var(--color-bg-muted);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--color-primary);
}

.response-text {
  margin: 0 0 var(--space-2) 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  line-height: var(--line-height-relaxed);
  white-space: pre-wrap;
}

.response-date {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

/* Action Section */
.action-section {
  display: flex;
  gap: var(--space-3);
  padding-top: var(--space-4);
  border-top: 2px solid var(--color-border);
}

/* Responsive */
@media (max-width: 640px) {
  .action-section {
    flex-direction: column-reverse;
  }

  .dispute-meta {
    flex-direction: column;
    align-items: flex-start;
  }

  .detail-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .detail-value {
    text-align: left;
  }
}
</style>
