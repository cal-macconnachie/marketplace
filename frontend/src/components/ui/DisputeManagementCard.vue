<template>
  <div class="dispute-management-card">
    <div class="card-header">
      <h3 class="card-title">Dispute Management</h3>
      <span v-if="pendingCount > 0" class="pending-badge">
        {{ pendingCount }} Pending
      </span>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <LoadingSpinner :size="24" />
      <p>Loading disputes...</p>
    </div>

    <!-- Error State -->
    <BaseAlert v-else-if="error" variant="error" :show="true">
      {{ error }}
    </BaseAlert>

    <!-- Empty State -->
    <div v-else-if="disputes.length === 0" class="empty-state">
      <svg class="empty-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <h6>No Disputes</h6>
      <p>You don't have any disputes at the moment.</p>
    </div>

    <!-- Disputes List -->
    <div v-else class="disputes-list">
      <div
        v-for="dispute in disputes"
        :key="dispute.id"
        class="dispute-item"
        :class="`status-${dispute.status}`"
      >
        <div class="dispute-header">
          <div class="dispute-meta">
            <span class="dispute-id">Dispute #{{ dispute.id.substring(0, 8) }}</span>
            <span class="dispute-date">{{ formatDate(dispute.created_at) }}</span>
          </div>
          <span class="status-badge" :class="`status-${dispute.status}`">
            {{ formatStatus(dispute.status) }}
          </span>
        </div>

        <div class="dispute-details">
          <div class="detail-row">
            <span class="detail-label">Amount:</span>
            <span class="detail-value">{{ formatMoneyInt(dispute.total_dispute_amount, dispute.currency) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Items:</span>
            <span class="detail-value">{{ dispute.purchase_ids.length }}</span>
          </div>
        </div>

        <div class="dispute-reason">
          <p class="reason-label">Reason:</p>
          <p class="reason-text">{{ dispute.reason }}</p>
        </div>

        <!-- Seller Response (if exists) -->
        <div v-if="dispute.seller_response" class="seller-response">
          <p class="response-label">Your Response:</p>
          <p class="response-text">{{ dispute.seller_response }}</p>
        </div>

        <!-- Actions -->
        <div v-if="dispute.status === 'pending'" class="dispute-actions">
          <BaseButton
            variant="outline"
            size="sm"
            @click="handleReject(dispute)"
          >
            Reject
          </BaseButton>
          <BaseButton
            variant="primary"
            size="sm"
            @click="handleAccept(dispute)"
          >
            Accept & Refund
          </BaseButton>
        </div>

        <!-- Status Messages -->
        <div v-else class="status-message" :class="`status-${dispute.status}`">
          <template v-if="dispute.status === 'accepted'">
            ✓ Dispute accepted. Refund has been processed.
          </template>
          <template v-else-if="dispute.status === 'escalated'">
            ⚠ Dispute escalated to platform team for review.
          </template>
          <template v-else-if="dispute.status === 'resolved'">
            ✓ Dispute resolved by platform team.
          </template>
        </div>
      </div>
    </div>

    <!-- Load More Button -->
    <div v-if="hasMore && !isLoading" class="load-more-section">
      <BaseButton
        variant="outline"
        @click="loadMore"
        :loading="isLoadingMore"
      >
        Load More
      </BaseButton>
    </div>

    <!-- Respond Modal -->
    <DisputeRespondModal
      :show="showRespondModal"
      :dispute="selectedDispute"
      :action="respondAction"
      @close="closeRespondModal"
      @success="handleRespondSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { useDisputeStore } from '@/stores/disputes'
import type { Dispute } from '@marketplace/types'
import { computed, onMounted, ref } from 'vue'
import BaseAlert from './BaseAlert.vue'
import BaseButton from './BaseButton.vue'
import DisputeRespondModal from './DisputeRespondModal.vue'
import LoadingSpinner from './LoadingSpinner.vue'

const disputeStore = useDisputeStore()

const isLoading = ref(false)
const isLoadingMore = ref(false)
const error = ref<string | null>(null)
const lastKey = ref<string | undefined>(undefined)
const hasMore = ref(false)

const showRespondModal = ref(false)
const selectedDispute = ref<Dispute | null>(null)
const respondAction = ref<'accept' | 'reject'>('accept')

const disputes = computed(() => disputeStore.disputes)
const pendingCount = computed(() => disputeStore.pendingDisputeCount)

onMounted(() => {
  loadDisputes()
})

async function loadDisputes() {
  isLoading.value = true
  error.value = null

  try {
    const response = await disputeStore.fetchDisputes({
      view: 'seller',
      limit: 10
    })

    hasMore.value = !!response.lastKey
    lastKey.value = response.lastKey
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load disputes'
  } finally {
    isLoading.value = false
  }
}

async function loadMore() {
  if (!lastKey.value) return

  isLoadingMore.value = true

  try {
    const response = await disputeStore.fetchDisputes({
      view: 'seller',
      limit: 10,
      lastKey: lastKey.value
    })

    hasMore.value = !!response.lastKey
    lastKey.value = response.lastKey
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load more disputes'
  } finally {
    isLoadingMore.value = false
  }
}

function handleAccept(dispute: Dispute) {
  selectedDispute.value = dispute
  respondAction.value = 'accept'
  showRespondModal.value = true
}

function handleReject(dispute: Dispute) {
  selectedDispute.value = dispute
  respondAction.value = 'reject'
  showRespondModal.value = true
}

function closeRespondModal() {
  showRespondModal.value = false
  selectedDispute.value = null
}

function handleRespondSuccess(updatedDispute: Dispute) {
  console.log('Dispute response submitted:', updatedDispute)
  // The store is already updated, just refresh the pending count
  disputeStore.refreshDisputeCount()
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
</script>

<style scoped>
.dispute-management-card {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

/* Card Header */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
}

.card-title {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.pending-badge {
  padding: var(--space-2) var(--space-3);
  background: var(--color-error-bg);
  color: var(--color-error);
  border: 1px solid var(--color-error-border);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-8);
  color: var(--color-text-secondary);
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-8);
  text-align: center;
}

.empty-icon {
  width: 48px;
  height: 48px;
  color: var(--color-text-muted);
}

.empty-state h6 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.empty-state p {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

/* Disputes List */
.disputes-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.dispute-item {
  padding: var(--space-4);
  background: var(--color-bg-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.dispute-item.status-pending {
  border-left: 4px solid var(--color-warning);
}

.dispute-item.status-accepted {
  border-left: 4px solid var(--color-success);
}

.dispute-item.status-escalated {
  border-left: 4px solid var(--color-error);
}

/* Dispute Header */
.dispute-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
}

.dispute-meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.dispute-id {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
  color: var(--color-text-primary);
}

.dispute-date {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
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

/* Dispute Details */
.dispute-details {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-3);
  background: var(--color-bg-primary);
  border-radius: var(--radius-sm);
}

.detail-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
}

.detail-label {
  color: var(--color-text-secondary);
}

.detail-value {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

/* Dispute Reason */
.dispute-reason {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.reason-label {
  margin: 0;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.reason-text {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  line-height: 1.5;
  white-space: pre-wrap;
}

/* Seller Response */
.seller-response {
  padding: var(--space-3);
  background: var(--color-bg-primary);
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--color-primary);
}

.response-label {
  margin: 0 0 var(--space-1) 0;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.response-text {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  line-height: 1.5;
}

/* Actions */
.dispute-actions {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}

/* Status Message */
.status-message {
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.status-message.status-accepted {
  background: var(--color-success-bg);
  color: var(--color-success);
  border: 1px solid var(--color-success-border);
}

.status-message.status-escalated {
  background: var(--color-warning-bg);
  color: var(--color-warning);
  border: 1px solid var(--color-warning-border);
}

.status-message.status-resolved {
  background: var(--color-info-bg);
  color: var(--color-info);
  border: 1px solid var(--color-info-border);
}

/* Load More */
.load-more-section {
  display: flex;
  justify-content: center;
  padding-top: var(--space-2);
}

/* Responsive */
@media (max-width: 640px) {
  .dispute-management-card {
    padding: var(--space-4);
  }

  .card-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .dispute-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .dispute-details {
    flex-direction: column;
    gap: var(--space-2);
  }

  .dispute-actions {
    flex-direction: column-reverse;
  }

  .dispute-actions button {
    width: 100%;
  }
}
</style>
