<template>
  <div class="base-tabs" role="tablist" :aria-label="ariaLabel">
    <div class="tabs-header">
      <button
        v-for="(tab, index) in tabs"
        :key="tab.id"
        :ref="el => setTabRef(el, index)"
        role="tab"
        :aria-selected="activeTabId === tab.id"
        :aria-controls="`tabpanel-${tab.id}`"
        :id="`tab-${tab.id}`"
        :tabindex="activeTabId === tab.id ? 0 : -1"
        class="tab-button"
        :class="{ 'tab-button--active': activeTabId === tab.id }"
        @click="selectTab(tab.id)"
        @keydown="handleKeyDown($event, index)"
      >
        <span class="tab-label">{{ tab.label }}</span>
        <span v-if="tab.badge !== undefined && tab.badge > 0" class="tab-badge">
          {{ tab.badge }}
        </span>
      </button>
    </div>

    <div class="tabs-content">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { provide, ref, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

interface Tab {
  id: string
  label: string
  badge?: number
}

interface Props {
  modelValue?: string
  ariaLabel?: string
  syncWithHash?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  ariaLabel: 'Dashboard navigation',
  syncWithHash: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const router = useRouter()
const route = useRoute()

const tabs = ref<Tab[]>([])
const activeTabId = ref<string>('')
const tabRefs = ref<(HTMLElement | null)[]>([])

const setTabRef = (el: any, index: number) => {
  if (el) {
    tabRefs.value[index] = el as HTMLElement
  }
}

const registerTab = (id: string, label: string, badge?: number) => {
  if (!tabs.value.find(t => t.id === id)) {
    tabs.value.push({ id, label, badge })
  }

  // Set initial active tab
  if (tabs.value.length === 1) {
    activeTabId.value = id
  }
}

const updateTabBadge = (id: string, badge: number | undefined) => {
  const tab = tabs.value.find(t => t.id === id)
  if (tab) {
    tab.badge = badge
  }
}

const selectTab = (id: string) => {
  activeTabId.value = id
  emit('update:modelValue', id)

  // Update URL hash
  if (props.syncWithHash) {
    router.push({ hash: `#${id}` })
  }
}

const handleKeyDown = (event: KeyboardEvent, currentIndex: number) => {
  let nextIndex = currentIndex

  switch (event.key) {
    case 'ArrowRight':
      event.preventDefault()
      nextIndex = currentIndex + 1
      if (nextIndex >= tabs.value.length) {
        nextIndex = 0
      }
      break
    case 'ArrowLeft':
      event.preventDefault()
      nextIndex = currentIndex - 1
      if (nextIndex < 0) {
        nextIndex = tabs.value.length - 1
      }
      break
    case 'Home':
      event.preventDefault()
      nextIndex = 0
      break
    case 'End':
      event.preventDefault()
      nextIndex = tabs.value.length - 1
      break
    default:
      return
  }

  const nextTab = tabs.value[nextIndex]
  if (nextTab) {
    selectTab(nextTab.id)
    tabRefs.value[nextIndex]?.focus()
  }
}

// Provide methods to child tabs
provide('registerTab', registerTab)
provide('updateTabBadge', updateTabBadge)
provide('activeTabId', activeTabId)

// Watch for external modelValue changes
watch(() => props.modelValue, (newValue) => {
  if (newValue && newValue !== activeTabId.value) {
    activeTabId.value = newValue
  }
})

// Initialize from URL hash on mount
onMounted(() => {
  if (props.syncWithHash && route.hash) {
    const hashTabId = route.hash.replace('#', '')
    const matchingTab = tabs.value.find(t => t.id === hashTabId)
    if (matchingTab) {
      activeTabId.value = hashTabId
      emit('update:modelValue', hashTabId)
    }
  } else if (props.modelValue) {
    activeTabId.value = props.modelValue
  } else if (tabs.value.length > 0) {
    activeTabId.value = tabs.value[0].id
    emit('update:modelValue', tabs.value[0].id)
  }
})
</script>

<style scoped>
.base-tabs {
  width: 100%;
}

.tabs-header {
  display: flex;
  gap: var(--space-2);
  border-bottom: 2px solid var(--color-border);
  margin-bottom: var(--space-6);
  overflow-x: auto;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE/Edge */
}

.tabs-header::-webkit-scrollbar {
  display: none; /* Chrome/Safari */
}

.tab-button {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  color: var(--color-text-secondary);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--transition-fast);
}

.tab-button:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-muted);
}

.tab-button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
  border-radius: var(--radius-sm);
}

.tab-button--active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.tab-label {
  line-height: 1;
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 var(--space-1);
  background: var(--color-error);
  color: white;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  line-height: 1;
}

.tab-button--active .tab-badge {
  background: var(--color-primary);
}

.tabs-content {
  animation: fadeIn 0.2s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Mobile responsive */
@media (max-width: 640px) {
  .tabs-header {
    gap: var(--space-1);
    margin-bottom: var(--space-4);
  }

  .tab-button {
    padding: var(--space-2) var(--space-3);
    font-size: var(--font-size-sm);
  }
}
</style>
