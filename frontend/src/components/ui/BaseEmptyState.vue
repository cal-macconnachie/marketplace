<template>
  <div class="base-empty-state" :class="{ 'empty-state--compact': compact }">
    <div v-if="icon" class="empty-state-icon">
      <slot name="icon">
        <svg
          v-if="icon === 'shopping-bag'"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path d="M16 11V7a4 4 0 0 0-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
        <svg
          v-else-if="icon === 'credit-card'"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
        <svg
          v-else-if="icon === 'box'"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
        <svg
          v-else-if="icon === 'alert'"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <svg
          v-else-if="icon === 'bell'"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        <svg
          v-else
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </slot>
    </div>

    <div class="empty-state-content">
      <h3 v-if="title" class="empty-state-title">{{ title }}</h3>
      <p v-if="description" class="empty-state-description">{{ description }}</p>
      <slot />
    </div>

    <div v-if="$slots.action || action" class="empty-state-action">
      <slot name="action">
        <BaseButton v-if="action" :variant="actionVariant" @click="handleAction">
          {{ action }}
        </BaseButton>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import BaseButton from './BaseButton.vue'

interface Props {
  icon?: 'shopping-bag' | 'credit-card' | 'box' | 'alert' | 'bell' | 'info'
  title?: string
  description?: string
  action?: string
  actionVariant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  compact?: boolean
}

withDefaults(defineProps<Props>(), {
  actionVariant: 'primary',
  compact: false,
})

const emit = defineEmits<{
  action: []
}>()

const handleAction = () => {
  emit('action')
}
</script>

<style scoped>
.base-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--space-12) var(--space-6);
  gap: var(--space-4);
  color: var(--color-text-secondary);
}

.empty-state--compact {
  padding: var(--space-6) var(--space-4);
  gap: var(--space-3);
}

.empty-state-icon {
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-state--compact .empty-state-icon svg {
  width: 32px;
  height: 32px;
}

.empty-state-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-width: 400px;
}

.empty-state-title {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.empty-state--compact .empty-state-title {
  font-size: var(--font-size-base);
}

.empty-state-description {
  margin: 0;
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  line-height: var(--line-height-relaxed);
}

.empty-state--compact .empty-state-description {
  font-size: var(--font-size-sm);
}

.empty-state-action {
  margin-top: var(--space-2);
}

@media (max-width: 640px) {
  .base-empty-state {
    padding: var(--space-8) var(--space-4);
  }

  .empty-state-icon svg {
    width: 40px;
    height: 40px;
  }

  .empty-state-title {
    font-size: var(--font-size-base);
  }

  .empty-state-description {
    font-size: var(--font-size-sm);
  }
}
</style>
