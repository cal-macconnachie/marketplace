<template>
  <div class="editable-field">
    <div
      v-if="!isEditing"
      class="field-display"
      :class="{ 'field-error': error }"
      @mouseenter="showEdit = true"
      @mouseleave="showEdit = false"
      @click="startEditing"
    >
      <span class="field-value">
        {{ displayValue }}
      </span>
      <div v-if="showEdit" class="edit-button" aria-label="Edit field">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
          />
        </svg>
      </div>
    </div>

    <div v-else class="field-edit">
      <textarea
        v-if="type === 'textarea'"
        ref="editInput"
        v-model="editValue"
        class="edit-input edit-textarea"
        :class="{ 'edit-input-empty': editValue.trim() === '', 'edit-input-error': error }"
        @blur="handleBlur"
        @keydown="handleKeydown"
        @input="resizeTextarea"
        :disabled="loading"
        :placeholder="placeholder"
        rows="1"
      />
      <input
        v-else
        ref="editInput"
        v-model="editValue"
        class="edit-input"
        :class="{ 'edit-input-empty': editValue.trim() === '', 'edit-input-error': error }"
        @blur="handleBlur"
        @keydown="handleKeydown"
        :disabled="loading"
        :placeholder="placeholder"
        :type="type || 'text'"
      />

      <div v-if="loading" class="loading-spinner">
        <svg class="spinner" width="16" height="16" viewBox="0 0 24 24">
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="2"
            fill="none"
            stroke-linecap="round"
            stroke-dasharray="31.416"
            stroke-dashoffset="31.416"
          >
            <animate
              attributeName="stroke-dasharray"
              dur="2s"
              values="0 31.416;15.708 15.708;0 31.416"
              repeatCount="indefinite"
            />
            <animate
              attributeName="stroke-dashoffset"
              dur="2s"
              values="0;-15.708;-31.416"
              repeatCount="indefinite"
            />
          </circle>
        </svg>
      </div>
    </div>

    <div
      v-if="label"
      class="field-label"
      :class="{ 'edit-label': isEditing, 'error-label': error }"
    >
      {{ label }}
    </div>
    <div v-if="error" class="error-message">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, computed } from 'vue'

interface Props {
  value: string
  field: string
  label?: string
  loading?: boolean
  type?: 'text' | 'textarea' | 'date'
  placeholder?: string
  emptyText?: string
  required?: boolean
  error?: string
}

interface Emits {
  (e: 'update', field: string, value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  type: 'text',
  placeholder: '',
  required: false,
})

const emit = defineEmits<Emits>()

const isEditing = ref(false)
const showEdit = ref(false)
const editValue = ref('')
const editInput = ref<HTMLInputElement | HTMLTextAreaElement>()

const displayValue = computed(() => {
  return props.value || ''
})

async function startEditing() {
  if (props.loading) return

  isEditing.value = true
  editValue.value = props.value || ''
  showEdit.value = false

  await nextTick()
  editInput.value?.focus()
  if (props.value) {
    editInput.value?.select()
  }

  if (props.type === 'textarea') {
    resizeTextarea()
  }
}

function handleBlur() {
  if (props.loading) return

  const newValue = editValue.value.trim()
  const originalValue = props.value || ''

  if (newValue !== originalValue) {
    emit('update', props.field, newValue)
  }

  isEditing.value = false
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && props.type !== 'textarea') {
    event.preventDefault()
    handleBlur()
  } else if (event.key === 'Escape') {
    editValue.value = props.value || ''
    isEditing.value = false
  }
}

function resizeTextarea() {
  if (props.type !== 'textarea' || !editInput.value) return

  const textarea = editInput.value as HTMLTextAreaElement
  textarea.style.height = 'auto'
  textarea.style.height = `${textarea.scrollHeight}px`
}
</script>

<style scoped>
.editable-field {
  position: relative;
  flex: 1;
  min-width: 0;
  width: 100%;
}

.field-label {
  position: absolute;
  top: -8px;
  left: 12px;
  background: var(--color-bg-primary);
  padding: 0 var(--space-2);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  z-index: 1;
  line-height: 1;
  transition: color 0.2s ease;
}

.edit-label {
  color: var(--color-primary) !important;
}

.error-label {
  color: var(--color-error, #ef4444) !important;
}

.error-message {
  font-size: var(--font-size-xs);
  color: var(--color-error, #ef4444);
  margin-top: var(--space-1);
  padding-left: var(--space-3);
  line-height: 1.2;
}

/* Fixed height container for both display and edit modes */
.field-display,
.field-edit {
  position: relative;
  border-radius: var(--radius-sm);
}

.field-display {
  display: flex;
  align-items: center;
  cursor: pointer;
  width: 100%;
  padding: var(--space-3);
  padding-top: var(--space-4);
  padding-bottom: var(--space-3);
  border: 1px solid var(--color-border);
  background: var(--color-bg-primary);
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.field-display:hover {
  border-color: var(--color-border-hover);
}

.field-display.field-error {
  border-color: var(--color-error, #ef4444);
}

.field-display.field-error:hover {
  border-color: var(--color-error, #ef4444);
}

.field-value {
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  text-align: left;
  word-break: break-word;
  flex: 1;
  width: 100%;
  padding-right: var(--space-6);
  line-height: 1.5; /* Match edit input line height */
  min-height: calc(1.5 * var(--font-size-sm)); /* Ensures empty fields maintain height for one line */
  white-space: pre-wrap; /* Preserve line breaks and formatting */
}

.edit-button {
  position: absolute;
  right: var(--space-2);
  top: 50%;
  transform: translateY(-50%);
  padding: var(--space-1);
  color: var(--color-text-secondary);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all 0.2s ease;
  z-index: 1;
  pointer-events: none;
}

.field-display:hover .edit-button {
  opacity: 1;
}

.field-edit {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.edit-input {
  flex: 1;
  padding: var(--space-3);
  padding-top: var(--space-4);
  padding-bottom: var(--space-3);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  text-align: left;
  line-height: 1.5; /* Match display line height */
  min-height: calc(1.5 * var(--font-size-sm) + var(--space-4) + var(--space-3) + 2px); /* Match total height with padding and border */
  box-sizing: border-box;
  font-family: inherit;
}

.edit-textarea {
  text-align: left;
  resize: none; /* Disable manual resize since we auto-grow */
  overflow: hidden; /* Hide scrollbars */
  line-height: 1.5;
}

.edit-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-alpha);
}

.edit-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.edit-input-empty {
  border-color: var(--color-border);
}

.edit-input-empty:focus {
  border-color: var(--color-primary);
}

.edit-input-error {
  border-color: var(--color-error, #ef4444);
}

.edit-input-error:focus {
  border-color: var(--color-error, #ef4444);
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.1);
}

.loading-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: var(--space-4);
}

.spinner {
  color: var(--color-primary);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Responsive design */
@media (max-width: 640px) {
  .field-value {
    padding-right: var(--space-8);
  }

  .edit-button {
    opacity: 1;
  }
}
</style>
