<template>
  <div class="infinite-purchases-list">
    <PurchasesList
      :purchases="purchases"
      :is-loading="isLoading"
      :viewer-type="viewerType"
      @get-more="fetchPurchases"
    />
  </div>
</template>

<script lang="ts" setup>
import { defineProps, onMounted, ref, computed } from 'vue'
import PurchasesList from './PurchasesList.vue'
import { useAppStore } from '@/stores/app'

const isLoading = ref(false)
const hasMoreData = ref(true)
const lastFetchTime = ref(0)
const FETCH_COOLDOWN = 1000 // 1 second cooldown
const app = useAppStore()

const { viewerType, limit = 10 } = defineProps<{
  viewerType?: 'purchaser' | 'seller'
  limit?: number
}>()

const purchases = computed(() => {
  if (viewerType === 'purchaser') {
    return app.userPurchases
  } else if (viewerType === 'seller') {
    return app.organizationPurchases
  }
  return []
})

const fetchPurchases = async () => {
  const now = Date.now()
  if (isLoading.value || !hasMoreData.value || now - lastFetchTime.value < FETCH_COOLDOWN) return

  isLoading.value = true
  lastFetchTime.value = now

  const previousCount = purchases.value.length

  let itemsReturned = 0
  if (viewerType === 'purchaser') {
    itemsReturned = (await app.getUserPurchases(limit)) || 0
  } else if (viewerType === 'seller') {
    itemsReturned = (await app.getSellerOrganizationPurchases(limit)) || 0
  }

  if (itemsReturned < limit) {
    hasMoreData.value = false
  }

  // If no new items were added, prevent further fetching
  if (purchases.value.length === previousCount) {
    hasMoreData.value = false
  }

  isLoading.value = false
}

onMounted(() => {
  fetchPurchases()
})
</script>
<style scoped>
.load-more {
  display: flex;
  justify-content: center;
  padding: var(--space-4);
}
</style>
