<template>
  <div
    class="product-badge"
    :class="{
      'product-badge--compact': compact,
      'product-badge--subscription':
        priceData.recurring && priceData.recurring.usage_type !== 'metered',
      'product-badge--metered': priceData.recurring && priceData.recurring.usage_type === 'metered',
      'product-badge--one-time': !priceData.recurring,
    }"
  >
    <!-- Subscription recurring icon -->
    <svg
      v-if="priceData.recurring && priceData.recurring.usage_type !== 'metered'"
      class="badge-icon"
      :width="compact ? 12 : 12"
      :height="compact ? 12 : 12"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fill-rule="evenodd"
        d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
        clip-rule="evenodd"
      />
    </svg>
    <!-- Metered billing icon -->
    <svg
      v-else-if="priceData.recurring && priceData.recurring.usage_type === 'metered'"
      class="badge-icon"
      :width="compact ? 12 : 12"
      :height="compact ? 12 : 12"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fill-rule="evenodd"
        d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 8a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 12a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 16a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
        clip-rule="evenodd"
      />
      <path d="M14 10l4 4-4 4V10z" fill="currentColor" />
    </svg>
    <!-- One-time icon -->
    <svg
      v-else
      class="badge-icon"
      :width="compact ? 12 : 12"
      :height="compact ? 12 : 12"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fill-rule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clip-rule="evenodd"
      />
    </svg>
    <span v-if="!compact" class="badge-text">
      {{
        priceData.recurring && priceData.recurring.usage_type === 'metered'
          ? 'Metered'
          : priceData.recurring
            ? 'Subscription'
            : 'One-time'
      }}
    </span>
  </div>
</template>

<script setup lang="ts">
interface PriceData {
  recurring?: {
    usage_type?: string
    interval?: string
    interval_count?: number
  }
}

interface Props {
  priceData: PriceData
  compact?: boolean
}

defineProps<Props>()
</script>

<style scoped>
.product-badge {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  margin-top: var(--space-1);
  margin-bottom: var(--space-1);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
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

.product-badge--metered {
  background: var(--color-metered-bg);
  color: var(--color-metered);
  border: 1px solid var(--color-metered-border);
}

.badge-icon {
  flex-shrink: 0;
}

.badge-text {
  font-size: var(--font-size-xs);
}

/* Compact variant */
.product-badge--compact {
  position: absolute;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  margin: var(--space-2);
  padding: 0;
  top: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
