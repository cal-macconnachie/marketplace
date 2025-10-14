<template>
  <BaseModal
    :show="show"
    title="Receipt Details"
    size="lg"
    variant="drawer"
    @close="$emit('close')"
  >
    <div v-if="isLoading" class="loading-state">
      <LoadingSpinner :size="32" />
      <p>Loading receipt...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <BaseAlert variant="error" :show="true">
        {{ error }}
      </BaseAlert>
    </div>

    <div v-else-if="receipt" class="receipt-details">
      <!-- Receipt Header -->
      <section class="receipt-header">
        <h3 class="receipt-title">Receipt #{{ receipt.receipt_number }}</h3>
        <p class="receipt-date">{{ receipt.purchase_datetime }}</p>
      </section>

      <!-- Customer Information -->
      <section class="details-section">
        <h4 class="section-title">Customer Information</h4>
        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">Name</span>
            <span class="info-value">{{ receipt.customer_name }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Email</span>
            <span class="info-value">{{ receipt.customer_email }}</span>
          </div>
          <div v-if="receipt.customer_phone" class="info-row">
            <span class="info-label">Phone</span>
            <span class="info-value">{{ receipt.customer_phone }}</span>
          </div>
        </div>
      </section>

      <!-- Payment Method -->
      <section v-if="receipt.payment_method_brand" class="details-section">
        <h4 class="section-title">Payment Method</h4>
        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">Card</span>
            <span class="info-value">
              {{ receipt.payment_method_brand }} •••• {{ receipt.payment_method_last4 }}
            </span>
          </div>
          <div v-if="receipt.payment_method_expiry_month" class="info-row">
            <span class="info-label">Expires</span>
            <span class="info-value">
              {{ String(receipt.payment_method_expiry_month).padStart(2, '0') }}/{{ receipt.payment_method_expiry_year }}
            </span>
          </div>
        </div>
      </section>

      <!-- Line Items (Multi-Seller) -->
      <section v-if="receipt.seller_groups && receipt.seller_groups.length > 0" class="details-section">
        <h4 class="section-title">Items Purchased</h4>

        <div v-for="sellerGroup in receipt.seller_groups" :key="sellerGroup.seller_id" class="seller-group">
          <div class="seller-info">
            <h5 class="seller-name">{{ sellerGroup.seller_name || 'Unknown Seller' }}</h5>
            <p v-if="sellerGroup.seller_email" class="seller-contact">
              <a :href="`mailto:${sellerGroup.seller_email}`">{{ sellerGroup.seller_email }}</a>
            </p>
          </div>

          <div class="line-items">
            <div v-for="(item, index) in sellerGroup.items" :key="`${sellerGroup.seller_id}-${index}`" class="line-item">
              <div class="item-details">
                <div class="item-header">
                  <h6 class="item-name">{{ item.product_name }}</h6>
                  <span v-if="item.is_subscription" class="subscription-badge">
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
                    </svg>
                    Subscription
                  </span>
                </div>
                <p v-if="item.product_description" class="item-description">{{ item.product_description }}</p>
                <p v-if="item.interval_text" class="item-interval">{{ item.interval_text }}</p>
                <div class="item-pricing">
                  <span class="item-quantity">Qty: {{ item.quantity }}</span>
                  <span class="item-unit-price">{{ item.unit_price_formatted }} each</span>
                  <span class="item-subtotal">{{ item.subtotal_formatted }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="seller-summary">
            <div class="summary-row">
              <span class="summary-label">Subtotal</span>
              <span class="summary-value">{{ sellerGroup.subtotal_formatted }}</span>
            </div>
            <div v-if="sellerGroup.tax_formatted" class="summary-row">
              <span class="summary-label">Tax</span>
              <span class="summary-value">{{ sellerGroup.tax_formatted }}</span>
            </div>
            <div v-if="sellerGroup.fees_formatted" class="summary-row">
              <span class="summary-label">Fees</span>
              <span class="summary-value">{{ sellerGroup.fees_formatted }}</span>
            </div>
            <div class="summary-row summary-total">
              <span class="summary-label">Total</span>
              <span class="summary-value">{{ sellerGroup.total_formatted }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Line Items (Single Seller - Backward Compatibility) -->
      <section v-else-if="receipt.line_items && receipt.line_items.length > 0" class="details-section">
        <h4 class="section-title">Items Purchased</h4>

        <div class="line-items">
          <div v-for="(item, index) in receipt.line_items" :key="index" class="line-item">
            <div class="item-details">
              <div class="item-header">
                <h6 class="item-name">{{ item.product_name }}</h6>
                <span v-if="item.is_subscription" class="subscription-badge">
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
                  </svg>
                  Subscription
                </span>
              </div>
              <p v-if="item.product_description" class="item-description">{{ item.product_description }}</p>
              <p v-if="item.interval_text" class="item-interval">{{ item.interval_text }}</p>
              <div class="item-pricing">
                <span class="item-quantity">Qty: {{ item.quantity }}</span>
                <span class="item-unit-price">{{ item.unit_price_formatted }} each</span>
                <span class="item-subtotal">{{ item.subtotal_formatted }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Receipt Summary (only show if more than 1 item) -->
      <section v-if="shouldShowSummary" class="details-section receipt-summary">
        <h4 class="section-title">Summary</h4>
        <div class="summary-breakdown">
          <div class="summary-row">
            <span class="summary-label">Subtotal</span>
            <span class="summary-value">{{ receipt.summary.subtotal_formatted }}</span>
          </div>
          <div v-if="receipt.summary.discounts_formatted" class="summary-row discount-row">
            <span class="summary-label">Discounts</span>
            <span class="summary-value">-{{ receipt.summary.discounts_formatted }}</span>
          </div>
          <div v-if="receipt.summary.tax_formatted" class="summary-row">
            <span class="summary-label">Tax</span>
            <span class="summary-value">{{ receipt.summary.tax_formatted }}</span>
          </div>
          <div v-if="receipt.summary.fees_formatted" class="summary-row">
            <span class="summary-label">Fees</span>
            <span class="summary-value">{{ receipt.summary.fees_formatted }}</span>
          </div>
          <div class="summary-row summary-total">
            <span class="summary-label">Total</span>
            <span class="summary-value">{{ receipt.summary.total_formatted }}</span>
          </div>
        </div>
      </section>

      <!-- Notes -->
      <section v-if="receipt.notes" class="details-section">
        <h4 class="section-title">Notes</h4>
        <p class="receipt-notes">{{ receipt.notes }}</p>
      </section>
    </div>

  </BaseModal>
</template>

<script setup lang="ts">
import { authAPI } from '@/services/api'
import type { ReceiptEmailContext } from '@marketplace/types'
import { computed, ref, watch } from 'vue'
import BaseAlert from './BaseAlert.vue'
import BaseModal from './BaseModal.vue'
import LoadingSpinner from './LoadingSpinner.vue'

interface Props {
  show: boolean
  cartId: string
  userId: string
}

const props = defineProps<Props>()

defineEmits<{
  close: []
}>()

const isLoading = ref(false)
const error = ref<string>('')
const receipt = ref<ReceiptEmailContext | null>(null)

// Calculate total number of items across all sellers
const totalItems = computed(() => {
  if (!receipt.value) return 0

  if (receipt.value.seller_groups && receipt.value.seller_groups.length > 0) {
    return receipt.value.seller_groups.reduce((total, group) => total + group.items.length, 0)
  }

  return receipt.value.line_items?.length || 0
})

const shouldShowSummary = computed(() => totalItems.value > 1)

async function loadReceipt() {
  if (!props.cartId || !props.userId) {
    error.value = 'Missing cart or user information'
    return
  }

  try {
    isLoading.value = true
    error.value = ''

    const response = await authAPI.getReceipt(props.cartId, props.userId)
    receipt.value = response
  } catch (err) {
    console.error('Failed to load receipt:', err)
    error.value = 'Failed to load receipt details'
  } finally {
    isLoading.value = false
  }
}

watch(() => props.show, (newShow) => {
  if (newShow) {
    loadReceipt()
  } else {
    // Reset state when drawer closes
    receipt.value = null
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

.receipt-details {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

/* Receipt Header */
.receipt-header {
  padding-bottom: var(--space-4);
  border-bottom: 2px solid var(--color-border);
}

.receipt-title {
  margin: 0 0 var(--space-2) 0;
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.receipt-date {
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

/* Info Grid */
.info-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-2);
  background: var(--color-bg-muted);
  border-radius: var(--radius-sm);
}

.info-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.info-value {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  text-align: right;
}

/* Seller Groups */
.seller-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--color-bg-muted);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.seller-info {
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}

.seller-name {
  margin: 0 0 var(--space-1) 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.seller-contact {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.seller-contact a {
  color: var(--color-primary);
  text-decoration: none;
}

.seller-contact a:hover {
  text-decoration: underline;
}

/* Line Items */
.line-items {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.line-item {
  padding: var(--space-4);
  background: var(--color-bg-primary);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.item-details {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
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

.subscription-badge svg {
  flex-shrink: 0;
}

.item-description {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-relaxed);
}

.item-interval {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  font-style: italic;
}

.item-pricing {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-top: var(--space-1);
}

.item-quantity,
.item-unit-price {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.item-subtotal {
  margin-left: auto;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

/* Seller Summary */
.seller-summary {
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}

/* Summary Breakdown */
.summary-breakdown {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
  background: var(--color-bg-muted);
  border-radius: var(--radius-md);
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-2) 0;
}

.summary-row.discount-row .summary-value {
  color: rgb(34, 197, 94);
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

/* Receipt Summary */
.receipt-summary .summary-breakdown {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
}

/* Notes */
.receipt-notes {
  margin: 0;
  padding: var(--space-4);
  background: var(--color-bg-muted);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-relaxed);
}

/* Responsive */
@media (max-width: 640px) {
  .item-pricing {
    flex-wrap: wrap;
  }

  .item-subtotal {
    width: 100%;
    text-align: right;
    margin-left: 0;
  }
}
</style>
