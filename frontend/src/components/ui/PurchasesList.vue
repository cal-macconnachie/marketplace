<template>
  <div ref="listRef" class="purchases-list">
    <div v-if="purchases.length === 0" class="empty-state">No purchases found.</div>
    <div v-else>
      <PurchaseLineItem
        v-for="purchase in purchases"
        :key="purchase.id"
        :purchase="purchase"
        :viewer-type="viewerType"
      />
      <div v-if="isLoading" class="load-more"><LoadingSpinner size="32" /></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits, ref, onMounted, onUnmounted } from 'vue'
import type { Purchase } from '@/services/api'
import PurchaseLineItem from './PurchaseLineItem.vue'
import LoadingSpinner from './LoadingSpinner.vue'

const {
  purchases,
  isLoading = false,
  viewerType = 'purchaser',
} = defineProps<{
  purchases: Purchase[]
  isLoading?: boolean
  viewerType?: 'purchaser' | 'seller'
}>()

const emit = defineEmits<{
  'get-more': []
}>()

const listRef = ref<HTMLElement>()
const lastEmitTime = ref(0)
const DEBOUNCE_DELAY = 300

const handleScroll = () => {
  if (!listRef.value || isLoading) return

  const now = Date.now()
  if (now - lastEmitTime.value < DEBOUNCE_DELAY) return

  const { scrollTop, scrollHeight, clientHeight } = listRef.value
  const scrollPercentage = (scrollTop + clientHeight) / scrollHeight

  if (scrollPercentage > 0.8) {
    lastEmitTime.value = now
    emit('get-more')
  }
}

onMounted(() => {
  listRef.value?.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  listRef.value?.removeEventListener('scroll', handleScroll)
})
</script>

<style scoped>
.purchases-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-height: 500px;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.purchases-list::-webkit-scrollbar {
  display: none;
}

.empty-state {
  padding: var(--space-8);
  text-align: center;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-muted);
}
.load-more {
  padding: var(--space-4);
  text-align: center;
}
</style>
