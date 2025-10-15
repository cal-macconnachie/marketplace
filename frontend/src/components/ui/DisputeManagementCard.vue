<template>
  <BaseCard title="Dispute Management" padding="lg">
    <template #header>
      <div class="card-header-content">
        <h3 class="card-title">Dispute Management</h3>
      </div>
    </template>

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
      >
        <div class="dispute-header">
          <div class="dispute-meta">
            <div class="status-icon" :class="`status-${dispute.status}`">
              <svg v-if="dispute.status === 'pending'" width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd" />
              </svg>
              <svg v-else-if="dispute.status === 'accepted'" width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
              <svg v-else-if="dispute.status === 'rejected'" width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
              </svg>
              <svg v-else-if="dispute.status === 'escalated'" width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
              <svg v-else-if="dispute.status === 'resolved'" width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="dispute-info">
              <span class="dispute-amount">{{ formatMoneyInt(dispute.total_dispute_amount, dispute.currency) }}</span>
              <span class="dispute-date">{{ formatDate(dispute.created_at) }} • {{ dispute.purchase_ids.length }} {{ dispute.purchase_ids.length === 1 ? 'item' : 'items' }}</span>
            </div>
          </div>
        </div>

        <div class="dispute-reason">
          <p class="reason-label">Reason</p>
          <p class="reason-text">{{ truncateReason(dispute.reason) }}</p>
        </div>

        <!-- Seller Response (if exists) -->
        <div v-if="dispute.seller_response" class="seller-response">
          <p class="response-label">Your Response</p>
          <p class="response-text">{{ dispute.seller_response }}</p>
        </div>

        <!-- Actions -->
        <div v-if="dispute.status === 'pending'" class="dispute-actions">
          <BaseButton
            variant="ghost"
            size="sm"
            @click="handleViewDetails(dispute)"
          >
            View Details
          </BaseButton>
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
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            Dispute accepted. Refund has been processed.
          </template>
          <template v-else-if="dispute.status === 'rejected'">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
            Dispute rejected.
          </template>
          <template v-else-if="dispute.status === 'escalated'">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
            Dispute escalated to platform team for review.
          </template>
          <template v-else-if="dispute.status === 'resolved'">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            Dispute resolved by platform team.
          </template>
        </div>
      </div>
    </div>

    <template v-if="hasMore && !isLoading" #footer>
      <div class="load-more-section">
        <BaseButton
          variant="outline"
          @click="loadMore"
          :loading="isLoadingMore"
          fullWidth
        >
          Load More
        </BaseButton>
      </div>
    </template>

    <!-- Dispute Details Drawer -->
    <DisputeDetailsDrawer
      :show="showDetailsDrawer"
      :dispute="selectedDispute"
      @close="closeDetailsDrawer"
    />

    <!-- Respond Modal -->
    <DisputeRespondModal
      :show="showRespondModal"
      :dispute="selectedDispute"
      :action="respondAction"
      @close="closeRespondModal"
      @success="handleRespondSuccess"
    />
  </BaseCard>
</template>

<script setup lang="ts">
import { useDisputeStore } from '@/stores/disputes'
import type { Dispute } from '@marketplace/types'
import { computed, onMounted, ref } from 'vue'
import BaseAlert from './BaseAlert.vue'
import BaseButton from './BaseButton.vue'
import BaseCard from './BaseCard.vue'
import DisputeDetailsDrawer from './DisputeDetailsDrawer.vue'
import DisputeRespondModal from './DisputeRespondModal.vue'
import LoadingSpinner from './LoadingSpinner.vue'

const disputeStore = useDisputeStore()

const isLoading = ref(false)
const isLoadingMore = ref(false)
const error = ref<string | null>(null)
const lastKey = ref<string | undefined>(undefined)
const hasMore = ref(false)

const showDetailsDrawer = ref(false)
const showRespondModal = ref(false)
const selectedDispute = ref<Dispute | null>(null)
const respondAction = ref<'accept' | 'reject'>('accept')

const disputes = computed(() => disputeStore.disputes)

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

function handleViewDetails(dispute: Dispute) {
  selectedDispute.value = dispute
  showDetailsDrawer.value = true
}

function closeDetailsDrawer() {
  showDetailsDrawer.value = false
  selectedDispute.value = null
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

function truncateReason(reason: string, maxLength: number = 150): string {
  if (reason.length <= maxLength) return reason
  return reason.substring(0, maxLength) + '...'
}
</script>

<style scoped>
/* Card Header */
.card-header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  width: 100%;
}

.card-title {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.pending-badge {
  padding: var(--space-2) var(--space-3);
  background: var(--color-warning-bg);
  color: var(--color-warning);
  border: 1px solid var(--color-warning-border);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-8);
  color: var(--color-text-secondary);
  min-height: 200px;
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
  gap: var(--space-3);
}

.dispute-item {
  padding: var(--space-4);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  transition: all var(--transition-base);
}

.dispute-item:hover {
  border-color: var(--color-border-hover);
  box-shadow: var(--shadow-sm);
}

/* Dispute Header */
.dispute-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
}

.dispute-meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex: 1;
}

.status-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
}

.status-icon.status-pending {
  color: var(--color-warning);
}

.status-icon.status-accepted {
  color: var(--color-success);
}

.status-icon.status-rejected {
  color: var(--color-text-secondary);
}

.status-icon.status-escalated {
  color: var(--color-error);
}

.status-icon.status-resolved {
  color: var(--color-info);
}

.dispute-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.dispute-amount {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.dispute-date {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

/* Dispute Reason */
.dispute-reason {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.reason-label {
  margin: 0;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.reason-text {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  line-height: var(--line-height-relaxed);
  white-space: pre-wrap;
}

/* Seller Response */
.seller-response {
  padding: var(--space-3);
  background: var(--color-bg-muted);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.response-label {
  margin: 0 0 var(--space-2) 0;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.response-text {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  line-height: var(--line-height-relaxed);
  white-space: pre-wrap;
}

/* Actions */
.dispute-actions {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}

/* Status Message */
.status-message {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.status-message svg {
  flex-shrink: 0;
}

.status-message.status-accepted {
  background: var(--color-success-bg);
  color: var(--color-success);
  border: 1px solid var(--color-success-border);
}

.status-message.status-rejected {
  background: var(--color-bg-muted);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
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
  padding-top: var(--space-2);
}

/* Responsive */
@media (max-width: 640px) {
  .card-header-content {
    flex-direction: column;
    align-items: flex-start;
  }

  .dispute-actions {
    flex-direction: column;
    gap: var(--space-2);
  }

  .dispute-actions button {
    width: 100%;
  }
}
</style>
