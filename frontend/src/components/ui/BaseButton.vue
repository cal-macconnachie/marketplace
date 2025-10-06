<template>
  <button :class="buttonClasses" :disabled="disabled || loading" :type="type" @click="handleClick">
    <div v-if="loading" class="loading-container"><LoadingSpinner size="18" /></div>
    <span v-if="!showingConfirm" :class="{ 'loading-text': loading }">
      <slot />
    </span>
    <div v-else class="confirm-container">
      <span @click="confirmAction">{{ confirmDialogue }}</span>
      <svg class="cancel-icon" viewBox="0 0 20 20" fill="currentColor" @click.stop="cancelAction">
        <path
          fill-rule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clip-rule="evenodd"
        />
      </svg>
    </div>
  </button>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import LoadingSpinner from './LoadingSpinner.vue'

interface Props {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'xs' | 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit' | 'reset'
  fullWidth?: boolean
  confirmDialogue?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  type: 'button',
  disabled: false,
  loading: false,
  fullWidth: false,
  confirmDialogue: '',
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const showingConfirm = ref(false)

const handleClick = (event: MouseEvent) => {
  if (props.confirmDialogue) {
    showingConfirm.value = true
  } else {
    emit('click', event)
  }
}

const confirmAction = (event: MouseEvent) => {
  showingConfirm.value = false
  emit('click', event)
}

const cancelAction = () => {
  showingConfirm.value = false
}

const buttonClasses = computed(() => [
  'base-button',
  `base-button--${props.variant}`,
  `base-button--${props.size}`,
  {
    'base-button--loading': props.loading,
    'base-button--full-width': props.fullWidth,
  },
])
</script>

<style scoped>
.base-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-family: var(--font-family-sans);
  font-weight: var(--font-weight-medium);
  line-height: var(--line-height-tight);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  text-decoration: none;
  white-space: nowrap;
  user-select: none;
  position: relative;
}

.base-button:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 2px;
}

/* Variants */
.base-button--primary {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border-color: var(--color-primary);
}

.base-button--primary:hover:not(:disabled):not(.base-button--confirming) {
  background-color: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.base-button--secondary {
  background-color: var(--color-secondary);
  color: var(--color-text-inverse);
  border-color: var(--color-secondary);
}

.base-button--secondary:hover:not(:disabled):not(.base-button--confirming) {
  background-color: var(--color-secondary-hover);
  border-color: var(--color-secondary-hover);
}

.base-button--outline {
  background-color: transparent;
  color: var(--color-primary);
  border-color: var(--color-border);
}

.base-button--outline:hover:not(:disabled):not(.base-button--confirming) {
  background-color: var(--color-primary-light);
  border-color: var(--color-primary);
}

.base-button--ghost {
  background-color: transparent;
  color: var(--color-text-secondary);
  border-color: transparent;
}

.base-button--ghost:hover:not(:disabled):not(.base-button--confirming) {
  color: var(--color-text-primary);
}

.base-button--danger {
  background-color: var(--color-primary-bg);
  color: var(--color-text-primary);
  border-color: var(--color-error);
}

.base-button--danger:hover:not(:disabled):not(.base-button--confirming) {
  background-color: var(--color-error-bg);
  border-color: var(--color-error);
}

/* Sizes */
.base-button--xs {
  padding: var(--space-1) var(--space-2);
  font-size: var(--font-size-xs);
}

.base-button--sm {
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-sm);
}

.base-button--md {
  padding: var(--space-3) var(--space-4);
  font-size: var(--font-size-base);
}

.base-button--lg {
  padding: var(--space-4) var(--space-6);
  font-size: var(--font-size-lg);
}

/* States */
.base-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.base-button--full-width {
  width: 100%;
}

.base-button--loading {
  cursor: wait;
}

.loading-text {
  opacity: 0.7;
}

.loading-container {
  filter: brightness(400%);
}

.base-button--xs .confirm-button {
  padding: var(--space-1) var(--space-2);
}

.base-button--sm .confirm-button {
  padding: var(--space-2) var(--space-3);
}

.base-button--md .confirm-button {
  padding: var(--space-3) var(--space-4);
}

.base-button--lg .confirm-button {
  padding: var(--space-4) var(--space-6);
}

.cancel-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  flex-shrink: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: all var(--transition-fast);
  padding: 0;
}

.cancel-icon {
  width: 16px;
  height: 16px;
}

.confirm-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: var(--space-2);
}

.confirm-container span {
  flex: 1;
  text-align: center;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
