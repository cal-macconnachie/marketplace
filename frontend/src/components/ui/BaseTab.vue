<template>
  <div
    v-show="isActive"
    :id="`tabpanel-${id}`"
    role="tabpanel"
    :aria-labelledby="`tab-${id}`"
    class="base-tab"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import { inject, computed, onMounted, watch } from 'vue'
import type { Ref } from 'vue'

interface Props {
  id: string
  label: string
  badge?: number
  icon?: string
}

const props = defineProps<Props>()

const registerTab = inject<(id: string, label: string, badge?: number, icon?: string) => void>('registerTab')
const updateTabBadge = inject<(id: string, badge: number | undefined) => void>('updateTabBadge')
const activeTabId = inject<Ref<string>>('activeTabId')

const isActive = computed(() => activeTabId?.value === props.id)

onMounted(() => {
  if (registerTab) {
    registerTab(props.id, props.label, props.badge, props.icon)
  }
})

// Watch for badge changes and update parent
watch(() => props.badge, (newBadge) => {
  if (updateTabBadge) {
    updateTabBadge(props.id, newBadge)
  }
}, { immediate: true })
</script>

<style scoped>
.base-tab {
  width: 100%;
}
</style>
