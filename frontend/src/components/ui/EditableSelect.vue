<template>
  <div class="editable-field">
    <div
      v-if="!isEditing"
      class="field-display"
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
      <div class="select-wrapper">
        <div
          ref="editInput"
          class="edit-input select-display"
          :class="{ 'edit-input-empty': editValue === '' }"
          @click="toggleDropdown"
          @keydown="handleKeydown"
          tabindex="0"
        >
          {{ selectedLabel || placeholder }}
        </div>
        
        <div v-if="showDropdown" class="dropdown-overlay" @click.self="closeDropdown">
          <div class="dropdown-options" :style="dropdownStyle">
            <div
              v-for="option in options"
              :key="option.value"
              class="dropdown-option"
              :class="{ 'option-selected': option.value === editValue }"
              @click="selectOption(option)"
            >
              {{ option.label }}
            </div>
          </div>
        </div>
      </div>

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

    <div v-if="label" class="field-label" :class="{ 'edit-label': isEditing }">{{ label }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, computed, reactive } from 'vue'
import type { SelectOption } from '@marketplace/types'

interface Props {
  value: string
  field: string
  label?: string
  loading?: boolean
  placeholder?: string
  options: SelectOption[]
}

interface Emits {
  (e: 'update', field: string, value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  placeholder: 'Select an option',
})

const emit = defineEmits<Emits>()

const isEditing = ref(false)
const showEdit = ref(false)
const editValue = ref('')
const editInput = ref<HTMLDivElement>()
const showDropdown = ref(false)
const dropdownStyle = reactive({
  top: '0px',
  left: '0px',
  width: '0px'
})

const displayValue = computed(() => {
  const option = props.options.find(opt => opt.value === props.value)
  return option?.label || ''
})

const selectedLabel = computed(() => {
  const option = props.options.find(opt => opt.value === editValue.value)
  return option?.label || ''
})

async function startEditing() {
  if (props.loading) return

  isEditing.value = true
  editValue.value = props.value || ''
  showEdit.value = false

  await nextTick()
  editInput.value?.focus()
  updateDropdownPosition()
  showDropdown.value = true
}

function updateDropdownPosition() {
  if (!editInput.value) return
  
  const rect = editInput.value.getBoundingClientRect()
  dropdownStyle.top = `${rect.bottom + 2}px`
  dropdownStyle.left = `${rect.left}px`
  dropdownStyle.width = `${rect.width}px`
}

function toggleDropdown() {
  if (!showDropdown.value) {
    updateDropdownPosition()
  }
  showDropdown.value = !showDropdown.value
}

function closeDropdown() {
  showDropdown.value = false
  isEditing.value = false
}

function selectOption(option: SelectOption) {
  editValue.value = option.value
  
  const originalValue = props.value || ''
  if (option.value !== originalValue) {
    emit('update', props.field, option.value)
  }
  
  // Exit edit mode immediately after selection
  showDropdown.value = false
  isEditing.value = false
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    if (showDropdown.value) {
      showDropdown.value = false
    } else {
      showDropdown.value = true
    }
  } else if (event.key === 'Escape') {
    editValue.value = props.value || ''
    showDropdown.value = false
    isEditing.value = false
  } else if (event.key === ' ') {
    event.preventDefault()
    showDropdown.value = true
  }
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

/* Fixed height container for both display and edit modes */
.field-display,
.field-edit {
  min-height: 2.5rem;
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
  border: 1px solid var(--color-border);
  background: var(--color-bg-primary);
  transition: all 0.2s ease;
}

.field-display:hover {
  border-color: var(--color-border-hover);
}

.field-value {
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  text-align: left;
  word-break: break-word;
  flex: 1;
  width: 100%;
  padding-right: var(--space-6);
  line-height: 1.25rem; /* Fixed line height for consistency */
  min-height: 1.25rem; /* Ensures empty fields maintain height */
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
  align-items: flex-start;
  gap: var(--space-2);
}

.edit-input {
  flex: 1;
  padding: var(--space-3);
  padding-top: var(--space-4);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  text-align: left;
  min-height: 2.5rem;
  line-height: 1.25rem; /* Match display line height */
  box-sizing: border-box;
  font-family: inherit;
  cursor: pointer;
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

/* Custom select styles */
.select-wrapper {
  position: relative;
  flex: 1;
}

.select-display {
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
}

.select-display::after {
  content: '▼';
  position: absolute;
  right: var(--space-3);
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  pointer-events: none;
}

.dropdown-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
}

.dropdown-options {
  position: fixed;
  max-height: 240px;
  overflow-y: auto;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  z-index: 1000;
}

.dropdown-option {
  padding: var(--space-3);
  cursor: pointer;
  transition: background-color 0.2s ease;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
}

.dropdown-option:hover {
  background-color: var(--color-bg-secondary);
}

.option-selected {
  background-color: var(--color-primary-alpha);
  font-weight: var(--font-weight-medium);
}

.option-selected:hover {
  background-color: var(--color-primary-alpha);
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