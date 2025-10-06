<template>
  <div>
    <!-- Original Card -->
    <div :class="cardClasses" ref="originalCard">
      <!-- Expand Button (shows on hover when expandable) -->
      <button v-if="expandable" class="expand-btn" @click="toggleExpanded" aria-label="Expand card">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
          />
        </svg>
      </button>

      <header v-if="$slots.header || title" class="card-header">
        <slot name="header">
          <h2 v-if="title" class="card-title">{{ title }}</h2>
        </slot>
      </header>

      <div v-if="$slots.default" class="card-body">
        <slot :expanded="false" />
      </div>

      <footer v-if="$slots.footer" class="card-footer">
        <slot name="footer" />
      </footer>
    </div>

    <!-- Modal using BaseModal -->
    <BaseModal
      v-if="expandable"
      :show="isExpanded"
      :title="title"
      size="xl"
      @close="closeModal"
    >
      <template v-if="$slots.header" #header>
        <slot name="header" />
      </template>

      <div :class="modalCardClasses">
        <slot :expanded="true" />
      </div>

      <template v-if="$slots.footer" #footer>
        <slot name="footer" />
      </template>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, readonly } from 'vue'
import BaseModal from './BaseModal.vue'

interface Props {
  title?: string
  variant?: 'default' | 'outlined' | 'elevated'
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'auto'
  hoverable?: boolean
  expandable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'elevated',
  padding: 'md',
  hoverable: false,
  expandable: false,
})

const isExpanded = ref(false)
const originalCard = ref<HTMLElement>()

const cardClasses = computed(() => [
  'base-card',
  `base-card--${props.variant}`,
  `base-card--padding-${props.padding}`,
  {
    'base-card--hoverable': props.hoverable,
    'base-card--expandable': props.expandable,
  },
])

const modalCardClasses = computed(() => [
  'modal-card-content',
])

const toggleExpanded = () => {
  if (!props.expandable) return
  isExpanded.value = !isExpanded.value
}

const closeModal = () => {
  isExpanded.value = false
}

defineExpose({
  toggleExpanded,
  isExpanded: readonly(isExpanded),
})
</script>

<style scoped>
.base-card {
  background-color: var(--color-bg-primary);
  border-radius: var(--radius-lg);
  transition: all var(--transition-fast);
  position: relative;
  /* flex: 1; */
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Variants */
.base-card--default {
  border: none;
}

.base-card--elevated {
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
}

/* Padding variants */
.base-card--padding-auto {
  padding: auto;
}
.base-card--padding-none {
  padding: 0;
}

.base-card--padding-sm {
  padding: var(--space-4);
}

.base-card--padding-md {
  padding: var(--space-6);
}

.base-card--padding-lg {
  padding: var(--space-8);
}

/* Hoverable */
.base-card--hoverable {
  cursor: pointer;
}

.base-card--hoverable:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(0px);
}

/* Modal card content */
.modal-card-content {
  /* Add any specific styling for the modal content if needed */
}

/* Expandable card styles */
.base-card--expandable {
  position: relative;
}

.expand-btn {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-2);
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transform: scale(0.8);
  pointer-events: none;
  background: none;
}

.base-card--expandable:hover .expand-btn {
  opacity: 1;
  transform: scale(1);
  pointer-events: auto;
}

.expand-btn:hover {
  background: var(--color-bg-muted);
  color: var(--color-text-primary);
  box-shadow: var(--shadow-sm);
}

.expand-btn:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  opacity: 1;
  transform: scale(1);
  pointer-events: auto;
}

/* Card sections */
.card-header {
  margin-bottom: var(--space-4);
}

.card-title {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  line-height: var(--line-height-tight);
}

.card-body {
  flex: 1;
}

.card-footer {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

/* Remove padding for specific sections when card has no padding */
.base-card--padding-none .card-header {
  padding: var(--space-6) var(--space-6) 0;
  margin-bottom: 0;
}

.base-card--padding-none .card-body {
  padding: var(--space-4) var(--space-6);
}

.base-card--padding-none .card-footer {
  padding: 0 var(--space-6) var(--space-6);
  margin-top: 0;
}

.base-card:hover {
  opacity: 1;
  visibility: visible;
}

/* Desktop only visibility */
.desktop-only {
  display: block;
}

@media (max-width: 768px) {
  .desktop-only {
    display: none;
  }
}
</style>
