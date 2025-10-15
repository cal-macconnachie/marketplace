<template>
  <div class="buying-tab">
    <div class="tab-grid">
      <!-- Payment Action Required Alert -->
      <PaymentActionRequired v-if="app.hasPurchased" class="payment-action-alert" />

      <!-- Payment Methods Card -->
      <BaseCard title="Payment Methods" :min-height="240">
        <template v-if="paymentMethodsLoading">
          <BaseSkeleton variant="card" :height="200" />
        </template>
        <template v-else>
          <div class="payment-methods-section">
            <PaymentMethodList
              v-if="paymentMethods.length > 0"
              :payment-methods="paymentMethods"
              @archive-payment-method="handleArchivePaymentMethod"
            />
            <BaseEmptyState
              v-else
              icon="credit-card"
              title="No Payment Methods"
              description="Add a payment method to start purchasing products."
              :compact="true"
            />
            <PaymentMethodForm
              :key="`payment-form-${paymentMethods.length}`"
              :has-existing-payment-method="paymentMethods.length > 0"
              @payment-method-added="handlePaymentMethodAdded"
            />
          </div>
        </template>
      </BaseCard>

      <!-- Products Card -->
      <BaseCard
        v-if="products.length > 0 && paymentMethods.length > 0"
        title="Products For You"
        :expandable="true"
        :min-height="300"
      >
        <template #default>
          <div class="product-list">
            <ProductsList :products="products" @purchase-success="handlePurchaseSuccess" />
          </div>
        </template>
      </BaseCard>

      <!-- Empty State for Products -->
      <BaseCard v-else-if="!paymentMethodsLoading && paymentMethods.length > 0" title="Products For You" :min-height="300">
        <BaseEmptyState
          icon="shopping-bag"
          title="No Products Available"
          description="Products will appear here when they become available for your account."
        />
      </BaseCard>

      <!-- Purchases Card -->
      <BaseCard v-if="app.hasPurchased" title="Your Purchases" :expandable="true" :min-height="300">
        <template #default>
          <InfinitePurchasesList :viewer-type="'purchaser'" :limit="10" />
        </template>
      </BaseCard>

      <!-- Subscription Card -->
      <BaseCard
        v-if="app.hasSubscription"
        title="Subscription"
        ref="subscriptionCard"
        :expandable="true"
        :min-height="240"
      >
        <template #default="{ expanded }">
          <SubscriptionManager :expanded="expanded" @expand="handleSubscriptionExpanded" />
        </template>
      </BaseCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue'
import InfinitePurchasesList from '@/components/ui/InfinitePurchasesList.vue'
import PaymentActionRequired from '@/components/ui/PaymentActionRequired.vue'
import PaymentMethodForm from '@/components/ui/PaymentMethodForm.vue'
import PaymentMethodList from '@/components/ui/PaymentMethodList.vue'
import ProductsList from '@/components/ui/ProductsList.vue'
import SubscriptionManager from '@/components/ui/SubscriptionManager.vue'
import { useAppStore } from '@/stores/app'
import type { PaymentMethod, Product } from '@marketplace/types'
import { ref, onMounted } from 'vue'

const app = useAppStore()
const paymentMethods = ref<PaymentMethod[]>([])
const products = ref<Product[]>([])
const paymentMethodsLoading = ref(true)
const subscriptionCard = ref<InstanceType<typeof BaseCard>>()

async function fetchPaymentMethods() {
  const userId = app.user?.id
  if (!userId) return

  paymentMethodsLoading.value = true
  const paymentMethodsResponse = await app.getPaymentMethods(userId)
  if (paymentMethodsResponse) {
    paymentMethods.value = paymentMethodsResponse
  }
  paymentMethodsLoading.value = false
}

async function fetchProducts() {
  try {
    const groupIds = ['standard']
    if (app.user?.product_groups) {
      groupIds.push(...app.user.product_groups)
    }
    if (app.user?.email) {
      groupIds.push(app.user.email)
    }
    const organizationId = app.user?.organization_id
    if (organizationId) {
      groupIds.push(organizationId)
    }

    const promises = groupIds.map((groupId) => app.getProducts(groupId))
    const productGroups = await Promise.all(promises)

    // Collect all valid products from all groups
    const allProducts: Product[] = []
    for (const productResponse of productGroups) {
      if (productResponse && productResponse.length > 0) {
        allProducts.push(...productResponse)
      }
    }

    // If no products found, set empty array and return
    if (allProducts.length === 0) {
      products.value = []
      return
    }

    const userEmail = app.user?.email ?? ''

    // Remove duplicates based on id and group_id combination, then sort
    const uniqueProducts = allProducts.filter(
      (product, index, self) =>
        index === self.findIndex((p) => p.id === product.id && p.group_id === product.group_id),
    )

    products.value = uniqueProducts.sort((a, b) => {
      if (a.group_id === userEmail && b.group_id !== userEmail) {
        return -1
      }
      if (a.group_id !== userEmail && b.group_id === userEmail) {
        return 1
      }
      if (
        a.metadata?.sort &&
        b.metadata?.sort &&
        !isNaN(Number(a.metadata?.sort)) &&
        !isNaN(Number(b.metadata?.sort)) &&
        a.metadata.sort !== b.metadata.sort
      ) {
        return Number(a.metadata.sort) - Number(b.metadata.sort)
      }
      return a.name.localeCompare(b.name)
    })
  } catch (error) {
    console.error('Error fetching products:', error)
    products.value = []
  }
}

async function handlePurchaseSuccess() {
  await app.getUserPurchases()
  await app.fetchOrganization()
}

async function handlePaymentMethodAdded() {
  await fetchPaymentMethods()
  await fetchProducts()
}

async function handleArchivePaymentMethod(paymentMethodId: string) {
  // Remove the payment method from the local array first
  paymentMethods.value = paymentMethods.value.filter((pm) => pm.id !== paymentMethodId)

  // Refresh user data to ensure consistency
  try {
    await fetchPaymentMethods()

    // Small delay to ensure component has time to remount properly
    await new Promise((resolve) => setTimeout(resolve, 100))
  } catch (error) {
    console.error('Error refreshing after archive:', error)
  }
}

function handleSubscriptionExpanded() {
  subscriptionCard.value?.toggleExpanded()
}

onMounted(async () => {
  if (app.isAuthenticated && app.user) {
    await Promise.all([
      fetchPaymentMethods(),
      fetchProducts(),
      app.getUserPurchases()
    ])
  }
})
</script>

<style scoped>
.buying-tab {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.tab-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
  gap: var(--space-6);
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.payment-action-alert {
  grid-column: 1 / -1;
}

.payment-methods-section {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.product-list {
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

@media (max-width: 768px) {
  .tab-grid {
    grid-template-columns: 1fr;
  }
}
</style>
