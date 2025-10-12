<template>
  <div
    :class="[
      'notification-item',
      { unread: !notification.read },
      { expandable: hasMetadata },
      { expanded: isExpanded }
    ]"
    @click="handleClick"
  >
    <div class="notification-indicator">
      <div v-if="!notification.read" class="unread-dot"></div>
    </div>
    <div class="notification-content">
      <div class="notification-header">
        <h5 class="notification-title">{{ notification.title }}</h5>
        <span class="notification-time">{{ formattedTimestamp }}</span>
      </div>
      <p class="notification-message">{{ notification.message }}</p>
      <div class="notification-badges">
        <span
          :class="['notification-type', `type-${notification.type}`]"
        >
          {{ formattedType }}
        </span>
      </div>

      <!-- Expandable metadata section -->
      <div
        v-if="hasMetadata"
        class="notification-breakdown"
        :class="{ visible: isExpanded }"
      >
        <div v-if="notification.metadata?.order_id" class="breakdown-row">
          <span>Order ID</span>
          <span class="breakdown-value">{{ notification.metadata.order_id }}</span>
        </div>
        <div v-if="notification.metadata?.customer_name" class="breakdown-row">
          <span>Customer</span>
          <span class="breakdown-value">{{ notification.metadata.customer_name }}</span>
        </div>
        <div v-if="notification.metadata?.customer_email" class="breakdown-row">
          <span>Email</span>
          <span class="breakdown-value">{{ notification.metadata.customer_email }}</span>
        </div>
        <div v-if="notification.metadata?.customer_phone" class="breakdown-row">
          <span>Phone</span>
          <span class="breakdown-value">{{ notification.metadata.customer_phone }}</span>
        </div>
        <div v-if="notification.metadata?.line_items?.length" class="breakdown-section">
          <div class="breakdown-row">
            <span style="font-weight: 600;">Items</span>
          </div>
          <div v-for="(item, index) in notification.metadata.line_items" :key="index" class="line-item">
            <div class="line-item-header">
              <span class="line-item-name">{{ item.product_name }}</span>
              <span class="breakdown-value">{{ item.subtotal_formatted }}</span>
            </div>
            <div class="line-item-details">
              <span>Qty: {{ item.quantity }}</span>
              <span>{{ item.unit_price_formatted }} each</span>
            </div>
          </div>
        </div>
        <div v-if="notification.metadata?.summary" class="breakdown-section">
          <div v-if="notification.metadata.summary.subtotal" class="breakdown-row">
            <span>Subtotal</span>
            <span class="breakdown-value">{{ notification.metadata.summary.subtotal_formatted }}</span>
          </div>
          <div v-if="notification.metadata.summary.discount" class="breakdown-row discount">
            <span>Discount</span>
            <span class="breakdown-value">-{{ notification.metadata.summary.discount_formatted }}</span>
          </div>
          <div v-if="notification.metadata.summary.tax" class="breakdown-row">
            <span>Tax</span>
            <span class="breakdown-value">{{ notification.metadata.summary.tax_formatted }}</span>
          </div>
          <div v-if="notification.metadata.summary.total" class="breakdown-row total">
            <span>Total</span>
            <span class="breakdown-value">{{ notification.metadata.summary.total_formatted }}</span>
          </div>
        </div>
        <div v-if="notification.metadata?.shipping_address" class="breakdown-section">
          <div class="breakdown-row">
            <span>Shipping Address</span>
          </div>
          <div class="shipping-address">
            <p>{{ notification.metadata.shipping_address.address_line1 }}</p>
            <p v-if="notification.metadata.shipping_address.address_line2">{{ notification.metadata.shipping_address.address_line2 }}</p>
            <p>{{ notification.metadata.shipping_address.city }}, {{ notification.metadata.shipping_address.state }} {{ notification.metadata.shipping_address.postal_code }}</p>
            <p>{{ notification.metadata.shipping_address.country }}</p>
          </div>
        </div>

        <!-- Action buttons -->
        <div v-if="hasActions" class="notification-actions">
          <!-- Sale notification: Print shipping label -->
          <BaseButton
            v-if="notification.type === 'sale' && notification.metadata?.shipping_address"
            variant="primary"
            size="sm"
            @click.stop="handlePrintShippingLabel"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              :style="{ marginRight: '6px' }"
            >
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Print Shipping Label
          </BaseButton>

          <!-- Receipt notification: View receipt -->
          <BaseButton
            v-if="notification.type === 'receipt' && notification.metadata?.order_id"
            variant="primary"
            size="sm"
            @click.stop="handleViewReceipt"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              :style="{ marginRight: '6px' }"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            View Receipt
          </BaseButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Notification } from '@marketplace/types'
import { computed } from 'vue'
import BaseButton from './BaseButton.vue'

interface Props {
  notification: Notification
  isExpanded: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  click: [notification: Notification]
  markAsRead: [notificationId: string]
}>()

// Computed
const hasMetadata = computed(() => {
  return !!(
    props.notification.metadata &&
    (props.notification.metadata.order_id ||
      props.notification.metadata.customer_name ||
      props.notification.metadata.summary ||
      props.notification.metadata.shipping_address ||
      props.notification.metadata.line_items?.length)
  )
})

const hasActions = computed(() => {
  // Sale notifications with shipping address can print label
  if (props.notification.type === 'sale' && props.notification.metadata?.shipping_address) {
    return true
  }
  // Receipt notifications can view receipt
  if (props.notification.type === 'receipt' && props.notification.metadata?.order_id) {
    return true
  }
  return false
})

const formattedTimestamp = computed(() => {
  const date = new Date(props.notification.created_at)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
})

const formattedType = computed(() => {
  return props.notification.type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
})

// Methods
function handleClick() {
  emit('click', props.notification)
}

function handlePrintShippingLabel() {
  if (!props.notification.metadata?.shipping_address) return

  // Create a printable shipping label
  const address = props.notification.metadata.shipping_address
  const customerName = props.notification.metadata.customer_name || 'Customer'
  const orderId = props.notification.metadata.order_id || 'N/A'

  // Create a new window with shipping label content
  const printWindow = window.open('', '_blank', 'width=600,height=400')
  if (!printWindow) return

  // Build contact info HTML
  const emailHtml = props.notification.metadata.customer_email
    ? '<div>Email: ' + props.notification.metadata.customer_email + '</div>'
    : ''
  const phoneHtml = props.notification.metadata.customer_phone
    ? '<div>Phone: ' + props.notification.metadata.customer_phone + '</div>'
    : ''
  const line2Html = address.address_line2 ? '<div>' + address.address_line2 + '</div>' : ''

  const htmlContent = '<!DOCTYPE html>' +
    '<html>' +
    '<head>' +
    '<title>Shipping Label - Order ' + orderId + '</title>' +
    '<style>' +
    'body { font-family: Arial, sans-serif; padding: 20px; max-width: 600px; }' +
    'h1 { font-size: 24px; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }' +
    '.section { margin: 20px 0; }' +
    '.label { font-weight: bold; margin-bottom: 5px; }' +
    '.address { font-size: 18px; line-height: 1.6; padding: 15px; border: 2px solid #000; margin: 10px 0; }' +
    '@media print { body { padding: 0; } }' +
    '</style>' +
    '</head>' +
    '<body>' +
    '<h1>Shipping Label</h1>' +
    '<div class="section">' +
    '<div class="label">Order ID:</div>' +
    '<div>' + orderId + '</div>' +
    '</div>' +
    '<div class="section">' +
    '<div class="label">Ship To:</div>' +
    '<div class="address">' +
    '<div>' + customerName + '</div>' +
    '<div>' + address.address_line1 + '</div>' +
    line2Html +
    '<div>' + address.city + ', ' + address.state + ' ' + address.postal_code + '</div>' +
    '<div>' + address.country + '</div>' +
    '</div>' +
    '</div>' +
    '<div class="section">' +
    '<div class="label">Contact Information:</div>' +
    emailHtml +
    phoneHtml +
    '</div>' +
    '<script>window.onload = function() { window.print(); }<' + '/script>' +
    '</body>' +
    '</html>'

  printWindow.document.write(htmlContent)
  printWindow.document.close()
}

function handleViewReceipt() {
  if (!props.notification.metadata?.order_id) return

  // Open receipt page in new tab
  const receiptUrl = `/receipts/${props.notification.metadata.order_id}`
  window.open(receiptUrl, '_blank')
}
</script>

<style scoped>
.notification-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
}

.notification-item.expandable {
  cursor: pointer;
}

.notification-item.expanded {
  padding-bottom: 0;
}

.notification-item.unread {
  background: var(--color-bg-muted);
  border-color: var(--color-primary-alpha);
}

.notification-item.unread:hover,
.notification-item.expandable:hover {
  border-color: var(--color-primary);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.notification-item:not(.unread):not(.expandable) {
  opacity: 0.7;
}

.notification-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  flex-shrink: 0;
  padding-top: var(--space-1);
}

.unread-dot {
  width: 8px;
  height: 8px;
  background: var(--color-primary);
  border-radius: 50%;
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.notification-title {
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.notification-time {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.notification-message {
  margin: 0 0 var(--space-2) 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.notification-badges {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  margin-top: var(--space-2);
}

.notification-type {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
}

.notification-type.type-receipt {
  background: rgba(59, 130, 246, 0.1);
  color: rgb(59, 130, 246);
}

.notification-type.type-sale {
  background: rgba(34, 197, 94, 0.1);
  color: rgb(34, 197, 94);
}

/* Notification Breakdown */
.notification-breakdown {
  margin-top: var(--space-4);
  padding-top: 0;
  padding-bottom: 0;
  background: var(--color-bg-secondary);
  /* Extend to full width by accounting for parent padding and indicator width */
  margin-left: calc(-1 * (var(--space-4) + var(--space-3) + 20px));
  margin-right: calc(-1 * var(--space-4));
  padding-left: calc(var(--space-4) + var(--space-3) + 20px);
  padding-right: var(--space-4);
  border-radius: var(--radius-md);
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  transition: all 0.3s ease;
}

.notification-breakdown.visible {
  max-height: 500px;
  opacity: 1;
  padding-top: var(--space-3);
  padding-bottom: var(--space-3);
}

.breakdown-section {
  margin-top: var(--space-2);
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

.breakdown-row.total {
  border-top: 1px solid var(--color-border);
  margin-top: var(--space-2);
  padding-top: var(--space-2);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
}

.breakdown-value {
  font-family: var(--font-family-mono, monospace);
  font-weight: var(--font-weight-medium);
}

.line-item {
  padding: var(--space-2);
  margin: var(--space-2) 0;
  background: var(--color-bg-primary);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}

.line-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-1);
}

.line-item-name {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
}

.line-item-details {
  display: flex;
  gap: var(--space-3);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.shipping-address {
  margin-top: var(--space-2);
  padding: var(--space-2);
  background: var(--color-bg-primary);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.shipping-address p {
  margin: 0;
  line-height: 1.5;
}

/* Notification Actions */
.notification-actions {
  margin-top: var(--space-4);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

/* Responsive */
@media (max-width: 640px) {
  .notification-item {
    flex-direction: column;
    gap: var(--space-2);
  }

  .notification-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-1);
  }
}
</style>
