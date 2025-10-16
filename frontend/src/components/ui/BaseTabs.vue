<template>
  <div class="base-tabs" :class="{ 'base-tabs--vertical': variant === 'sidebar' }" role="tablist" :aria-label="ariaLabel">
    <div v-if="variant === 'sidebar'" class="tabs-sidebar" :class="{ 'tabs-sidebar--expanded': isExpanded }">
      <!-- Sidebar Header -->
      <div class="sidebar-header">
        <slot name="sidebar-header" :is-expanded="isExpanded"></slot>
      </div>

      <button class="sidebar-toggle" @click="toggleSidebar" aria-label="Toggle sidebar">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path v-if="isExpanded" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          <path v-else d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <nav class="tabs-nav">
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
          <span class="tab-icon" v-html="tab.icon"></span>
          <span v-if="isExpanded" class="tab-label">{{ tab.label }}</span>
          <span v-if="isExpanded && tab.badge !== undefined && tab.badge > 0" class="tab-badge">
            {{ tab.badge }}
          </span>
        </button>
      </nav>

      <!-- Sidebar Footer -->
      <div class="sidebar-footer">
        <slot name="sidebar-footer" :is-expanded="isExpanded"></slot>
      </div>
    </div>

    <div v-else class="tabs-header">
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
  icon?: string
}

interface Props {
  modelValue?: string
  ariaLabel?: string
  syncWithHash?: boolean
  variant?: 'horizontal' | 'sidebar'
}

const props = withDefaults(defineProps<Props>(), {
  ariaLabel: 'Dashboard navigation',
  syncWithHash: true,
  variant: 'horizontal',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const router = useRouter()
const route = useRoute()

const tabs = ref<Tab[]>([])
const activeTabId = ref<string>('')
const tabRefs = ref<(HTMLElement | null)[]>([])
const isExpanded = ref(false)

const setTabRef = (el: any, index: number) => {
  if (el) {
    tabRefs.value[index] = el as HTMLElement
  }
}

const toggleSidebar = () => {
  isExpanded.value = !isExpanded.value
}

const registerTab = (id: string, label: string, badge?: number, icon?: string) => {
  if (!tabs.value.find(t => t.id === id)) {
    tabs.value.push({ id, label, badge, icon })
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

.base-tabs--vertical {
  display: flex;
  gap: var(--space-6);
  align-items: flex-start;
  padding: var(--space-4);
}

/* Sidebar Layout */
.tabs-sidebar {
  position: sticky;
  top: var(--space-4);
  max-height: calc(100vh - var(--space-8));
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  width: 80px;
  transition: width var(--transition-base);
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  box-shadow: var(--shadow-sm);
}

.tabs-sidebar--expanded {
  width: 260px;
}

.sidebar-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}

.sidebar-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2);
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.sidebar-toggle:hover {
  background: var(--color-bg-muted);
  color: var(--color-text-primary);
}

.sidebar-toggle:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.tabs-nav {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex: 1;
}

.sidebar-footer {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
  margin-top: auto;
}

.tabs-sidebar .tab-button {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: var(--space-3);
  padding: var(--space-3);
  background: none;
  border: none;
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--transition-fast);
  text-align: left;
  width: 100%;
  min-height: 44px;
}

.tabs-sidebar:not(.tabs-sidebar--expanded) .tab-button {
  justify-content: center;
}

.tabs-sidebar .tab-button:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-muted);
}

.tabs-sidebar .tab-button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.tabs-sidebar .tab-button--active {
  color: var(--color-primary);
  background: var(--color-primary-light, rgba(59, 130, 246, 0.1));
}

.tab-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tab-icon :deep(svg) {
  width: 20px;
  height: 20px;
  stroke: currentColor;
}

.tabs-sidebar .tab-label {
  flex: 1;
  line-height: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tabs-sidebar .tab-badge {
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
  flex-shrink: 0;
}

.tabs-sidebar .tab-button--active .tab-badge {
  background: var(--color-primary);
}

/* Horizontal Layout */
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

.tabs-header .tab-button {
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

.tabs-header .tab-button:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-muted);
}

.tabs-header .tab-button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
  border-radius: var(--radius-sm);
}

.tabs-header .tab-button--active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.tabs-header .tab-label {
  line-height: 1;
}

.tabs-header .tab-badge {
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

.tabs-header .tab-button--active .tab-badge {
  background: var(--color-primary);
}

.tabs-content {
  flex: 1;
  min-width: 0;
  animation: fadeIn 0.2s ease-in;
}

.base-tabs--vertical .tabs-content {
  flex: 1;
  min-width: 0;
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
@media (max-width: 768px) {
  .base-tabs--vertical {
    flex-direction: column;
    padding: 0;
  }

  .tabs-sidebar {
    position: sticky;
    top: 0;
    width: 100%;
    max-height: none;
    border-radius: 0;
    border-left: none;
    border-right: none;
    padding: var(--space-3);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    z-index: 10;
    flex-direction: column;
    gap: var(--space-3);
  }

  .tabs-sidebar--expanded {
    width: 100%;
  }

  /* Hide toggle on mobile - always show content */
  .sidebar-toggle {
    display: none;
  }

  /* Top bar: back button on left, logout on right */
  .sidebar-header {
    flex-direction: row;
    justify-content: flex-start;
    align-items: center;
    gap: 0;
    padding-bottom: 0;
    border-bottom: none;
    order: 1;
  }

  /* Hide profile/avatar on mobile */
  .sidebar-header .sidebar-profile {
    display: none;
  }

  .sidebar-footer {
    flex-direction: row;
    justify-content: flex-end;
    align-items: center;
    padding-top: 0;
    border-top: none;
    margin-top: 0;
    margin-left: auto;
    order: 2;
  }

  /* Place header and footer in same row */
  .tabs-sidebar {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
    gap: var(--space-3);
    align-items: center;
  }

  .sidebar-header {
    grid-column: 1;
    grid-row: 1;
  }

  .sidebar-footer {
    grid-column: 2;
    grid-row: 1;
  }

  .tabs-nav {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  /* Horizontal scrolling tabs */
  .tabs-nav {
    flex-direction: row;
    gap: var(--space-1);
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
    padding: 0;
  }

  .tabs-nav::-webkit-scrollbar {
    display: none;
  }

  /* Compact tab buttons - icon + label vertical */
  .tabs-sidebar .tab-button {
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-3);
    min-width: 70px;
    min-height: auto;
    position: relative;
  }

  /* Always show labels on mobile (since toggle is hidden) */
  .tabs-sidebar .tab-button .tab-label {
    display: block;
    font-size: 11px;
    text-align: center;
    line-height: 1.2;
  }

  .tabs-sidebar .tab-icon {
    width: 20px;
    height: 20px;
  }

  /* Position badge absolutely on mobile */
  .tabs-sidebar .tab-badge {
    position: absolute;
    top: 4px;
    right: 4px;
    min-width: 16px;
    height: 16px;
    font-size: 10px;
  }

  /* Content full width on mobile */
  .base-tabs--vertical .tabs-content {
    width: 100%;
    padding: var(--space-4) var(--space-3);
  }
}

@media (max-width: 640px) {
  .tabs-header {
    gap: var(--space-1);
    margin-bottom: var(--space-4);
  }

  .tabs-header .tab-button {
    padding: var(--space-2) var(--space-3);
    font-size: var(--font-size-sm);
  }
}
</style>
