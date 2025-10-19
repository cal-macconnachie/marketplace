<template>
  <div class="selling-tab">
    <div class="tab-grid">
      <!-- Seller Setup Card (shown when onboarding not completed) -->
      <BaseCard
        v-if="!canCreateProducts"
        title="Seller Setup"
        :expandable="true"
        ref="sellerManagerCard"
      >
        <template #default="{ expanded }">
          <SellerManager :expanded="expanded" @get-started="handleGetStarted" />
        </template>
      </BaseCard>

      <!-- Seller Dashboard (shown when onboarding completed) -->
      <template v-else>
        <!-- Manage Products Card -->
        <BaseCard
          title="Manage Products"
          :expandable="true"
          ref="vendorProductsCard"
        >
          <template #default="{ expanded }">
            <VendorProducts
              :expanded="expanded"
              @edit="handleVendorProductEdit"
              @close="handleVendorProductClose"
            />
          </template>
        </BaseCard>

        <!-- Your Sales Card -->
        <BaseCard title="Your Sales" :expandable="true">
          <template #default>
            <InfinitePurchasesList :viewer-type="'seller'" :limit="10" />
          </template>
        </BaseCard>

        <!-- Dispute Management Card -->
        <DisputeManagementCard />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import BaseCard from '@/components/ui/BaseCard.vue'
import DisputeManagementCard from '@/components/ui/DisputeManagementCard.vue'
import InfinitePurchasesList from '@/components/ui/InfinitePurchasesList.vue'
import SellerManager from '@/components/ui/SellerManager.vue'
import VendorProducts from '@/components/ui/VendorProducts.vue'
import { useAppStore } from '@/stores/app'
import { onMounted, ref, watch } from 'vue'

const app = useAppStore()
const canCreateProducts = ref(false)
const vendorProductsCard = ref<InstanceType<typeof BaseCard>>()
const sellerManagerCard = ref<InstanceType<typeof BaseCard>>()

function handleVendorProductEdit() {
  vendorProductsCard.value?.toggleExpanded()
}

function handleVendorProductClose() {
  vendorProductsCard.value?.toggleExpanded()
}

function handleGetStarted() {
  sellerManagerCard.value?.toggleExpanded()
}

// Watch for organization changes and update card visibility
watch(
  () => app.organization,
  (newOrg) => {
    if (newOrg) {
      // Update product creation capability based on onboarding status
      canCreateProducts.value = newOrg.onboarding_status === 'completed'
    }
  },
  { deep: true },
)

onMounted(async () => {
  if (app.isAuthenticated && app.user) {
    await app.fetchOrganization()

    if (app.organization?.onboarding_status === 'completed') {
      canCreateProducts.value = true
      // Fetch seller organization purchases
      await app.getSellerOrganizationPurchases()
    }
  }
})
</script>

<style scoped>
.selling-tab {
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
  overflow: hidden;
}

.tab-grid > * {
  min-width: 0;
  max-width: 100%;
}

@media (max-width: 768px) {
  .tab-grid {
    grid-template-columns: 1fr;
  }
}
</style>
