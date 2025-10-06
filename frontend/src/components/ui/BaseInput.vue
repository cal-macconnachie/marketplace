<template>
  <div class="input-group">
    <label v-if="label" :for="inputId" class="input-label">
      {{ label }}
      <span v-if="required" class="required-indicator" aria-label="required">*</span>
    </label>
    
    <div class="input-wrapper">
      <input
        :id="inputId"
        ref="inputElement"
        :class="inputClasses"
        :type="type"
        :placeholder="placeholder"
        :disabled="disabled"
        :required="required"
        :autocomplete="autocomplete"
        :aria-describedby="hasError ? `${inputId}-error` : undefined"
        :aria-invalid="hasError"
        :value="modelValue"
        @input="handleInput"
        @blur="handleBlur"
        @focus="handleFocus"
      />
      
      <div v-if="$slots.suffix" class="input-suffix">
        <slot name="suffix" />
      </div>
    </div>
    
    <div v-if="hasError" :id="`${inputId}-error`" class="input-error" role="alert">
      {{ error }}
    </div>
    
    <div v-else-if="hint" class="input-hint">
      {{ hint }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'

interface Props {
  modelValue: string
  label?: string
  placeholder?: string
  type?: 'text' | 'email' | 'password' | 'tel' | 'url'
  required?: boolean
  disabled?: boolean
  error?: string
  hint?: string
  autocomplete?: string
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  size: 'md',
  required: false,
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  focus: []
  blur: []
}>()

const inputElement = ref<HTMLInputElement>()
const inputId = ref(`input-${Math.random().toString(36).substr(2, 9)}`)

const hasError = computed(() => !!props.error)

const inputClasses = computed(() => [
  'base-input',
  `base-input--${props.size}`,
  {
    'base-input--error': hasError.value,
    'base-input--disabled': props.disabled,
  },
])

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}

const handleFocus = () => {
  emit('focus')
}

const handleBlur = () => {
  emit('blur')
}

const focus = () => {
  nextTick(() => {
    inputElement.value?.focus()
  })
}

defineExpose({
  focus,
  inputElement,
})
</script>

<style scoped>
.input-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.input-label {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  line-height: var(--line-height-tight);
}

.required-indicator {
  color: var(--color-error);
  font-weight: var(--font-weight-bold);
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.base-input {
  width: 100%;
  font-family: var(--font-family-sans);
  background-color: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
  color: var(--color-text-primary);
}

.base-input:hover:not(:disabled) {
  border-color: var(--color-border-hover);
}

.base-input:focus {
  outline: none;
  border-color: var(--color-border-focus);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.base-input::placeholder {
  color: var(--color-text-muted);
}

/* Sizes */
.base-input--sm {
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-sm);
}

.base-input--md {
  padding: var(--space-3) var(--space-4);
  font-size: var(--font-size-base);
}

.base-input--lg {
  padding: var(--space-4) var(--space-5);
  font-size: var(--font-size-lg);
}

/* States */
.base-input--error {
  border-color: var(--color-error);
}

.base-input--error:focus {
  border-color: var(--color-error);
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
}

.base-input--disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: var(--color-bg-muted);
}

.input-suffix {
  position: absolute;
  right: var(--space-3);
  display: flex;
  align-items: center;
  color: var(--color-text-muted);
}

.input-error {
  font-size: var(--font-size-sm);
  color: var(--color-error);
  line-height: var(--line-height-tight);
}

.input-hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  line-height: var(--line-height-tight);
}
</style>