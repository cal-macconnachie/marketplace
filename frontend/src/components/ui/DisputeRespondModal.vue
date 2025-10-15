<template>
  <BaseModal
    :show="show"
    :title="`${action === 'accept' ? 'Accept' : 'Reject'} Dispute`"
    size="md"
    @close="$emit('close')"
  >
    <div class="dispute-respond-content">
      <!-- Dispute Information -->
      <section v-if="dispute" class="dispute-info">
        <div class="info-row">
          <span class="info-label">Amount:</span>
          <span class="info-value">{{ formatMoneyInt(dispute.total_dispute_amount, dispute.currency) }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Purchases:</span>
          <span class="info-value">{{ dispute.purchase_ids.length }} item(s)</span>
        </div>
      </section>

      <!-- Buyer's Reason -->
      <section v-if="dispute" class="buyer-reason">
        <h6 class="section-title">Buyer's Reason:</h6>
        <p class="reason-text">{{ dispute.reason }}</p>
      </section>

      <!-- Warning Message -->
      <BaseAlert :show="true" :variant="action === 'accept' ? 'warning' : 'info'">
        <template v-if="action === 'accept'">
          <strong>Warning:</strong> By accepting this dispute, the following will occur:
          <ul class="warning-list">
            <li>A full refund will be issued to the buyer</li>
            <li>Platform fees will be deducted from your account</li>
            <li>This action cannot be undone</li>
          </ul>
        </template>
        <template v-else>
          <strong>Note:</strong> By rejecting this dispute, it will be escalated to our platform team for review.
          They will make the final decision on whether to issue a refund.
        </template>
      </BaseAlert>

      <!-- Response Input -->
      <section class="response-section">
        <label for="response-input" class="response-label">
          Your Response *
        </label>
        <textarea
          id="response-input"
          v-model="responseText"
          class="response-textarea"
          :placeholder="`Explain why you are ${action === 'accept' ? 'accepting' : 'rejecting'} this dispute...`"
          rows="4"
        ></textarea>
        <p v-if="!responseText.trim() && attemptedSubmit" class="error-message">
          Response is required
        </p>
      </section>

      <!-- Actions -->
      <div class="modal-actions">
        <BaseButton
          variant="outline"
          @click="$emit('close')"
          :disabled="isSubmitting"
        >
          Cancel
        </BaseButton>
        <BaseButton
          :variant="action === 'accept' ? 'danger' : 'primary'"
          @click="submitResponse"
          :loading="isSubmitting"
          :disabled="!responseText.trim()"
        >
          {{ action === 'accept' ? 'Accept Dispute' : 'Reject Dispute' }}
        </BaseButton>
      </div>

      <!-- Error Display -->
      <BaseAlert
        v-if="error"
        variant="error"
        :show="true"
        dismissible
        @dismiss="error = null"
      >
        {{ error }}
      </BaseAlert>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { useDisputeStore } from '@/stores/disputes'
import type { Dispute } from '@marketplace/types'
import { ref } from 'vue'
import BaseAlert from './BaseAlert.vue'
import BaseButton from './BaseButton.vue'
import BaseModal from './BaseModal.vue'

interface Props {
  show: boolean
  dispute: Dispute | null
  action: 'accept' | 'reject'
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  success: [dispute: Dispute]
}>()

const disputeStore = useDisputeStore()
const responseText = ref('')
const isSubmitting = ref(false)
const error = ref<string | null>(null)
const attemptedSubmit = ref(false)

async function submitResponse() {
  if (!props.dispute) return

  attemptedSubmit.value = true

  if (!responseText.value.trim()) {
    error.value = 'Please provide a response'
    return
  }

  try {
    isSubmitting.value = true
    error.value = null

    const updatedDispute = await disputeStore.respondToDispute({
      dispute_id: props.dispute.id,
      action: props.action,
      response: responseText.value.trim()
    })

    // Emit success and close
    emit('success', updatedDispute)
    emit('close')

    // Reset form
    responseText.value = ''
    attemptedSubmit.value = false
  } catch (err) {
    console.error('Failed to respond to dispute:', err)
    error.value = err instanceof Error ? err.message : 'Failed to submit response'
  } finally {
    isSubmitting.value = false
  }
}

function formatMoneyInt(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount / 100)
}
</script>

<style scoped>
.dispute-respond-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

/* Dispute Info */
.dispute-info {
  padding: var(--space-4);
  background: var(--color-bg-muted);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--font-size-sm);
}

.info-label {
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
}

.info-value {
  color: var(--color-text-primary);
  font-weight: var(--font-weight-semibold);
}

/* Buyer Reason */
.buyer-reason {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.section-title {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.reason-text {
  margin: 0;
  padding: var(--space-3);
  background: var(--color-bg-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.5;
  white-space: pre-wrap;
}

/* Warning List */
.warning-list {
  margin: var(--space-2) 0 0 var(--space-4);
  padding: 0;
}

.warning-list li {
  margin: var(--space-1) 0;
  font-size: var(--font-size-sm);
}

/* Response Section */
.response-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.response-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.response-textarea {
  width: 100%;
  padding: var(--space-3);
  font-size: var(--font-size-sm);
  font-family: inherit;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  resize: vertical;
  min-height: 100px;
}

.response-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.response-textarea::placeholder {
  color: var(--color-text-muted);
}

.error-message {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-error);
}

/* Modal Actions */
.modal-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}

/* Responsive */
@media (max-width: 640px) {
  .modal-actions {
    flex-direction: column-reverse;
  }

  .modal-actions button {
    width: 100%;
  }
}
</style>
