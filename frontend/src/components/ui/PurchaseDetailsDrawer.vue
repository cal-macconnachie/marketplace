<template>
  <BaseModal
    :show="show"
    :title="drawerTitle"
    size="md"
    variant="drawer"
    @close="$emit('close')"
  >
    <div v-if="isLoading" class="loading-state">
      <LoadingSpinner :size="32" />
      <p>Loading purchase details...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
    </div>

    <div v-else class="purchase-details">
      <!-- Product Information -->
      <section class="details-section">
        <div v-if="product" class="product-display">
          <ProductCard :product="product" compact />
        </div>
        <div v-else class="product-placeholder">
          <p>{{ purchase.product_name }}</p>
          <span class="meta-item">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                clip-rule="evenodd"
              />
            </svg>
            {{ purchaseTypeLabel }}
          </span>
        </div>
      </section>

      <!-- Transaction Details -->
      <section class="details-section">
        <h4 class="section-title">Transaction Details</h4>
        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">Date</span>
            <span class="info-value">{{ formattedDate }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Status</span>
            <span
              class="info-value"
              :class="{
                'status--completed': purchase.status === 'completed',
                'status--pending': purchase.status === 'pending',
                'status--failed': purchase.status === 'failed',
              }"
            >
              {{ purchase.status.charAt(0).toUpperCase() + purchase.status.slice(1) }}
            </span>
          </div>
          <div class="info-row">
            <span class="info-label">Amount</span>
            <span class="info-value amount-highlight">
              {{ formatMoneyInt(purchase.amount, purchase.currency) }}
            </span>
          </div>
          <div v-if="purchase.base_amount" class="info-row">
            <span class="info-label">Base Amount</span>
            <span class="info-value">{{ formatMoneyInt(purchase.base_amount, purchase.currency) }}</span>
          </div>
          <div v-if="purchase.tax_amount && purchase.tax_amount > 0" class="info-row">
            <span class="info-label">Tax</span>
            <span class="info-value">{{ formatMoneyInt(purchase.tax_amount, purchase.currency) }}</span>
          </div>
          <div v-if="purchase.applied_discount" class="info-row">
            <span class="info-label">Discount</span>
            <span class="info-value discount-value">
              {{ discountDescription }}
            </span>
          </div>
          <div v-if="viewerType === 'seller' && purchase.platform_fee_amount" class="info-row">
            <span class="info-label">Platform Fee</span>
            <span class="info-value fee-value">
              -{{ formatMoneyInt(purchase.platform_fee_amount, purchase.currency) }}
            </span>
          </div>
          <div v-if="viewerType === 'seller' && purchase.platform_fee_amount" class="info-row">
            <span class="info-label">Received Amount</span>
            <span class="info-value amount-highlight">
              {{ formatMoneyInt(purchase.amount - purchase.platform_fee_amount, purchase.currency) }}
            </span>
          </div>
        </div>
      </section>

      <!-- Buyer/Seller Information -->
      <section class="details-section">
        <h4 class="section-title">{{ viewerType === 'seller' ? 'Buyer' : 'Seller' }} Information</h4>
        <div v-if="isLoadingParty" class="loading-state-small">
          <LoadingSpinner :size="20" />
          <span>Loading information...</span>
        </div>
        <div v-else-if="partyLoadError" class="error-state-small">
          <p>{{ partyLoadError }}</p>
        </div>
        <div v-else class="info-grid">
          <!-- Buyer info (for sellers) -->
          <template v-if="viewerType === 'seller' && buyer">
            <div class="info-row">
              <span class="info-label">Name</span>
              <span class="info-value">{{ buyer.name || `${buyer.given_name || ''} ${buyer.family_name || ''}`.trim() || 'N/A' }}</span>
            </div>
            <div v-if="buyer.email" class="info-row">
              <span class="info-label">Email</span>
              <span class="info-value">{{ buyer.email }}</span>
            </div>
            <div v-if="buyer.phone_number" class="info-row">
              <span class="info-label">Phone</span>
              <span class="info-value">{{ buyer.phone_number }}</span>
            </div>
            <div v-if="buyer.address" class="info-row">
              <span class="info-label">Address</span>
              <span class="info-value">
                {{ formatAddress(buyer.address) }}
              </span>
            </div>
          </template>

          <!-- Seller info (for buyers) -->
          <template v-if="viewerType === 'purchaser' && seller">
            <div class="info-row">
              <span class="info-label">Organization</span>
              <span class="info-value">{{ seller.name || 'N/A' }}</span>
            </div>
            <div v-if="seller.email" class="info-row">
              <span class="info-label">Email</span>
              <a :href="`mailto:${seller.email}`" class="info-value link">
                {{ seller.email }}
              </a>
            </div>
            <div v-if="seller.business_profile?.support_email" class="info-row">
              <span class="info-label">Support Email</span>
              <a :href="`mailto:${seller.business_profile.support_email}`" class="info-value link">
                {{ seller.business_profile.support_email }}
              </a>
            </div>
            <div v-if="seller.business_profile?.support_phone" class="info-row">
              <span class="info-label">Support Phone</span>
              <span class="info-value">{{ seller.business_profile.support_phone }}</span>
            </div>
            <div v-if="seller.address" class="info-row">
              <span class="info-label">Address</span>
              <span class="info-value">
                {{ formatAddress(seller.address) }}
              </span>
            </div>
            <div v-if="seller.business_profile?.url" class="info-row">
              <span class="info-label">Website</span>
              <a :href="seller.business_profile.url" target="_blank" rel="noopener noreferrer" class="info-value link">
                {{ seller.business_profile.url }}
              </a>
            </div>
            <div v-if="seller.business_profile?.support_url" class="info-row">
              <span class="info-label">Support Website</span>
              <a :href="seller.business_profile.support_url" target="_blank" rel="noopener noreferrer" class="info-value link">
                {{ seller.business_profile.support_url }}
              </a>
            </div>
          </template>
        </div>
      </section>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { authAPI, publicApi } from '@/services/api'
import type { Organization, Product, Purchase, User } from '@marketplace/types'
import { computed, onMounted, ref, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import LoadingSpinner from './LoadingSpinner.vue'
import ProductCard from './ProductCard.vue'

interface Props {
  show: boolean
  purchase: Purchase
  viewerType?: 'purchaser' | 'seller'
}

const props = withDefaults(defineProps<Props>(), {
  viewerType: 'purchaser',
})

defineEmits<{
  close: []
}>()

const isLoading = ref(false)
const error = ref<string>('')
const product = ref<Product | null>(null)

const isLoadingParty = ref(false)
const partyLoadError = ref<string>('')
const buyer = ref<User | null>(null)
const seller = ref<Organization | null>(null)

const drawerTitle = computed(() => {
  return `Purchase Details - ${props.purchase.product_name}`
})

const formattedDate = computed(() => {
  const date = new Date(props.purchase.purchased_at)
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
})

const purchaseTypeLabel = computed(() => {
  switch (props.purchase.type) {
    case 'subscription':
      return 'Subscription'
    case 'metered_subscription':
      return 'Metered Subscription'
    case 'one_time':
      return 'One-time Purchase'
    default:
      return props.purchase.type
  }
})

const discountDescription = computed(() => {
  if (!props.purchase.applied_discount) return ''

  const { type, code, coupon } = props.purchase.applied_discount

  if (type === 'promotion_code' && code) {
    return `Code: ${code}`
  }

  if (type === 'coupon' && coupon) {
    if (coupon.percent_off) {
      return `${coupon.percent_off}% off`
    }
    if (coupon.amount_off) {
      return `-${formatMoneyInt(coupon.amount_off, props.purchase.currency)}`
    }
  }

  return 'Applied'
})

function formatMoneyInt(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount / 100)
}

function formatAddress(address: { line_1: string; line_2?: string; city: string; state: string; postal_code: string; country: string }): string {
  const parts = [
    address.line_1,
    address.line_2,
    `${address.city}, ${address.state} ${address.postal_code}`,
    address.country,
  ].filter(Boolean)
  return parts.join(', ')
}

async function loadProductDetails() {
  if (!props.purchase.product_id || !props.purchase.product_group_id) {
    error.value = 'Missing product information'
    return
  }

  try {
    isLoading.value = true
    error.value = ''
    product.value = await publicApi.getPublicProduct(
      props.purchase.product_group_id,
      props.purchase.product_id,
    )
  } catch (err) {
    console.error('Failed to load product details:', err)
    error.value = 'Failed to load product details'
  } finally {
    isLoading.value = false
  }
}

async function loadPartyDetails() {
  try {
    isLoadingParty.value = true
    partyLoadError.value = ''

    if (props.viewerType === 'seller') {
      // Load buyer information
      const users = await authAPI.getCurrentUser()
      // In a real scenario, you'd fetch the specific buyer by user_id
      // For now, we'll use a placeholder or try to get from purchase data
      // This would need a proper API endpoint to fetch user by ID
      buyer.value = users
    } else {
      // Load seller organization information
      if (props.purchase.seller_organization_id) {
        seller.value = await publicApi.getPublicOrganization(props.purchase.seller_organization_id)
      } else if (props.purchase.organization_id) {
        seller.value = await publicApi.getPublicOrganization(props.purchase.organization_id)
      }
    }
  } catch (err) {
    console.error('Failed to load party details:', err)
    partyLoadError.value = 'Failed to load information'
  } finally {
    isLoadingParty.value = false
  }
}

watch(() => props.show, (newShow) => {
  if (newShow) {
    loadProductDetails()
    loadPartyDetails()
  } else {
    // Reset state when drawer closes
    product.value = null
    buyer.value = null
    seller.value = null
    error.value = ''
    partyLoadError.value = ''
  }
})

onMounted(() => {
  if (props.show) {
    loadProductDetails()
    loadPartyDetails()
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

.loading-state-small {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.error-state {
  padding: var(--space-4);
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-md);
  color: rgb(239, 68, 68);
}

.error-state-small {
  padding: var(--space-3);
  background: rgba(239, 68, 68, 0.05);
  border-radius: var(--radius-sm);
  color: rgb(239, 68, 68);
  font-size: var(--font-size-sm);
}

.purchase-details {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.details-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.section-title {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--color-border);
}

.product-display {
  display: flex;
  justify-content: center;
  align-items: center;
}

.product-display :deep(.base-card) {
  flex: 1;
  height: 100%;
}

.product-display :deep(.product-card) {
  min-width: 100%;
  max-width: 100%;
}

.product-display :deep(.product-price) {
  margin-top: auto;
}

.product-placeholder {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
  background: var(--color-bg-muted);
  border-radius: var(--radius-md);
}

.product-placeholder p {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.meta-item svg {
  flex-shrink: 0;
}

.info-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
  padding: var(--space-3);
  background: var(--color-bg-muted);
  border-radius: var(--radius-sm);
}

.info-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  flex-shrink: 0;
  min-width: 120px;
}

.info-value {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  text-align: right;
  word-break: break-word;
}

.info-value.monospace {
  font-family: var(--font-family-mono, 'Monaco', 'Courier New', monospace);
  font-size: var(--font-size-xs);
}

.info-value.amount-highlight {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-primary);
}

.info-value.discount-value {
  color: rgb(34, 197, 94);
  font-weight: var(--font-weight-medium);
}

.info-value.fee-value {
  color: rgb(239, 68, 68);
}

.info-value.link {
  color: var(--color-primary);
  text-decoration: none;
}

.info-value.link:hover {
  text-decoration: underline;
}

.status--completed {
  color: rgb(34, 197, 94);
  font-weight: var(--font-weight-semibold);
}

.status--pending {
  color: rgb(59, 130, 246);
  font-weight: var(--font-weight-semibold);
}

.status--failed {
  color: rgb(239, 68, 68);
  font-weight: var(--font-weight-semibold);
}

@media (max-width: 640px) {
  .info-row {
    flex-direction: column;
    gap: var(--space-1);
  }

  .info-label {
    min-width: auto;
  }

  .info-value {
    text-align: left;
  }
}
</style>
