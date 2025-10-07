<template>
  <div v-if="show" :class="alertClasses" role="alert">
    <div class="alert-icon" aria-hidden="true">
      <slot name="icon">
        <svg v-if="variant === 'error'" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
        
        <svg v-else-if="variant === 'warning'" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
        
        <svg v-else-if="variant === 'success'" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
        </svg>
        
        <svg v-else viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
        </svg>
      </slot>
    </div>
    
    <div class="alert-content">
      <p v-if="title" class="alert-title">{{ title }}</p>
      <div class="alert-message">
        <slot>{{ message }}</slot>
      </div>
    </div>

    <slot name="actions"></slot>
    
    <button
      v-if="dismissible"
      type="button"
      class="alert-dismiss"
      @click="handleDismiss"
      aria-label="Dismiss alert"
    >
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'info' | 'success' | 'warning' | 'error'
  title?: string
  message?: string
  show?: boolean
  dismissible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'info',
  show: true,
  dismissible: false,
})

const emit = defineEmits<{
  dismiss: []
}>()

const alertClasses = computed(() => [
  'base-alert',
  `base-alert--${props.variant}`,
])

const handleDismiss = () => {
  emit('dismiss')
}
</script>

<style scoped>
.base-alert {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid transparent;
}

.base-alert--info {
  background-color: rgba(59, 130, 246, 0.1);
  color: var(--color-info);
  border-color: rgba(59, 130, 246, 0.2);
}

.base-alert--success {
  background-color: rgba(16, 185, 129, 0.1);
  color: var(--color-success);
  border-color: rgba(16, 185, 129, 0.2);
}

.base-alert--warning {
  background-color: rgba(245, 158, 11, 0.1);
  color: var(--color-warning);
  border-color: rgba(245, 158, 11, 0.2);
}

.base-alert--error {
  background-color: rgba(239, 68, 68, 0.1);
  color: var(--color-error);
  border-color: rgba(239, 68, 68, 0.2);
}

.alert-icon {
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
  margin-top: 0.125rem;
}

.alert-content {
  flex: 1;
  min-width: 0;
}

.alert-title {
  margin: 0 0 var(--space-1) 0;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-tight);
}

.alert-message {
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.alert-dismiss {
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
  color: currentColor;
  opacity: 0.7;
  transition: opacity var(--transition-fast);
}

.alert-dismiss:hover {
  opacity: 1;
}

.alert-dismiss:focus {
  outline: 2px solid currentColor;
  outline-offset: 1px;
  opacity: 1;
}
</style>