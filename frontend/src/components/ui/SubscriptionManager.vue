<template>
  <div class="subscription-manager">
    <div v-if="loading" class="loading-state">
      <p>Loading subscriptions...</p>
    </div>
    <div v-else-if="expanded" class="expanded-manager">
      <div v-if="groupedSubscriptions.length === 0" class="no-subscriptions">
        <p>No active subscriptions found</p>
      </div>
      <div v-else class="subscription-groups">
        <div
          v-for="group in groupedSubscriptions"
          :key="group.billingDate"
          class="subscription-group"
        >
          <div class="group-header">
            <h4>Next billing: {{ formatDate(group.billingDate) }}</h4>
            <span class="product-count">{{ group.products.length }} product(s)</span>
          </div>
          <div class="product-list">
            <div v-for="product in group.products" :key="product.id" class="product-item">
              <div class="product-info">
                <h5>{{ product.name }}</h5>
                <p class="product-meta">{{ formatCurrency(product.amount, product.currency) }}</p>
              </div>
              <BaseButton
                @click="cancelIndividualSubscription(product)"
                variant="danger"
                size="sm"
                :disabled="cancellingItems.has(product.id)"
                :confirm-dialogue="'Confirm'"
              >
                {{ cancellingItems.has(product.id) ? 'Cancelling...' : 'Cancel' }}
              </BaseButton>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="compact-manager">
      <div v-if="groupedSubscriptions.length > 0" class="compact-summary">
        <p>{{ subscriptionPurchasedProducts.length }} active subscription(s)</p>
        <p class="next-billing">
          Next billing: {{ formatDate(groupedSubscriptions[0].billingDate) }}
        </p>
      </div>
      <BaseButton @click="$emit('expand')" variant="primary" full-width
        >Manage Subscriptions</BaseButton
      >
    </div>
  </div>
</template>
<script setup lang="ts">
import type { PurchasedProduct } from '@/services/api'
import { authAPI } from '@/services/api'
import { useAppStore } from '@/stores/app'
import { computed, onMounted, ref } from 'vue'
import BaseButton from './BaseButton.vue'

interface Props {
  expanded?: boolean
}

withDefaults(defineProps<Props>(), {
  expanded: false,
})

defineEmits(['expand'])
const appStore = useAppStore()
const cancellingItems = ref(new Set<string>())

const loading = ref(true)
const subscriptionPurchasedProducts = computed(() => appStore.subscriptionPurchasedProducts)

// Group subscriptions by their next billing date (in_good_standing_until)
const groupedSubscriptions = computed(() => {
  const groups = new Map<number, PurchasedProduct[]>()

  subscriptionPurchasedProducts.value.forEach((product) => {
    if (product.in_good_standing_until) {
      const billingDate = product.in_good_standing_until
      if (!groups.has(billingDate)) {
        groups.set(billingDate, [])
      }
      groups.get(billingDate)!.push(product)
    }
  })

  // Convert to array and sort by billing date (earliest first)
  return Array.from(groups.entries())
    .map(([billingDate, products]) => ({
      billingDate,
      products,
    }))
    .sort((a, b) => a.billingDate - b.billingDate)
})

const formatDate = (timestamp: number) => {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100)
}

const cancelIndividualSubscription = async (product: PurchasedProduct) => {
  if (!product.subscription_id) return

  cancellingItems.value.add(product.id)
  try {
    await authAPI.cancelSubscriptionItem(appStore.user?.id || '', product.subscription_id, product)
    // Refresh the subscription list
    await appStore.fetchSubscriptionPurchasedProducts()
  } catch (error) {
    console.error('Failed to cancel subscription:', error)
    alert('Failed to cancel subscription. Please try again.')
  } finally {
    cancellingItems.value.delete(product.id)
  }
}

onMounted(async () => {
  loading.value = true
  await appStore.fetchSubscriptionPurchasedProducts()
  loading.value = false
})
</script>

<style scoped>
.subscription-manager {
  padding: var(--space-4);
}

.loading-state {
  text-align: center;
  padding: var(--space-8);
  color: var(--color-text-secondary);
}

.expanded-manager h3 {
  margin-bottom: var(--space-4);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
}

.no-subscriptions {
  padding: var(--space-8);
  text-align: center;
  color: var(--color-text-muted);
}

.subscription-groups {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.subscription-group {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}

.group-header h4 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.product-count {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.product-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.product-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-sm);
}

.product-info h5 {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  margin-bottom: var(--space-1);
}

.product-meta {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.compact-manager {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.expand-button {
  padding: var(--space-2) var(--space-4);
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-weight: var(--font-weight-medium);
}

.expand-button:hover {
  opacity: 0.9;
}

.compact-summary {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.next-billing {
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}
</style>
