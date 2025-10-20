<template>
  <div class="phone-number-field">
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
      <div class="phone-input-wrapper">
        <select
          v-model="selectedCountry"
          class="country-select"
          :disabled="loading"
          @change="handleCountryChange"
          @blur="handleCountryBlur"
        >
          <option value="US">🇺🇸 +1</option>
          <option value="CA">🇨🇦 +1</option>
          <option value="GB">🇬🇧 +44</option>
          <option value="AU">🇦🇺 +61</option>
          <option value="DE">🇩🇪 +49</option>
          <option value="FR">🇫🇷 +33</option>
          <option value="JP">🇯🇵 +81</option>
          <option value="CN">🇨🇳 +86</option>
        </select>
        <input
          ref="editInput"
          v-model="editValue"
          class="edit-input"
          :class="{
            'edit-input-empty': editValue.trim() === '',
            'edit-input-error': validationError,
            'edit-input-valid': isValid && editValue.trim() !== ''
          }"
          @blur="handleBlur"
          @keydown="handleKeydown"
          @input="handleInput"
          :disabled="loading"
          :placeholder="placeholderText"
          type="tel"
        />
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

    <div
      v-if="label"
      class="field-label"
      :class="{ 'edit-label': isEditing, 'error-label': error || validationError }"
    >
      {{ label }}
    </div>
    <div v-if="error || validationError" class="error-message">
      {{ error || validationError }}
    </div>
    <div v-else-if="isEditing && editValue && isValid" class="success-message">
      {{ formattedNumber }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { parsePhoneNumber } from 'awesome-phonenumber'
import { computed, nextTick, ref, watch } from 'vue'

interface Props {
  value: string
  field: string
  label?: string
  loading?: boolean
  placeholder?: string
  error?: string
}

interface Emits {
  (e: 'update', field: string, value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  placeholder: '',
})

const emit = defineEmits<Emits>()

const isEditing = ref(false)
const showEdit = ref(false)
const editValue = ref('')
const selectedCountry = ref('CA')
const editInput = ref<HTMLInputElement>()
const validationError = ref('')
const isValid = ref(false)
const formattedNumber = ref('')

const displayValue = computed(() => {
  if (!props.value) return ''

  // Parse and format the stored value
  const pn = parsePhoneNumber(props.value)
  if (pn.valid) {
    return pn.number?.international || props.value
  }
  return props.value
})

const placeholderText = computed(() => {
  const examples: Record<string, string> = {
    US: '(202) 555-0123',
    CA: '(604) 555-0123',
    GB: '020 7123 4567',
    AU: '02 1234 5678',
    DE: '030 12345678',
    FR: '01 23 45 67 89',
    JP: '03-1234-5678',
    CN: '010-12345678',
  }
  return props.placeholder || examples[selectedCountry.value] || 'Enter phone number'
})

function detectCountryFromNumber(phoneNumber: string): string {
  if (!phoneNumber) return 'CA'

  const pn = parsePhoneNumber(phoneNumber)
  if (pn.valid && pn.regionCode) {
    return pn.regionCode
  }

  // Default to CA if we can't detect
  return 'CA'
}

async function startEditing() {
  if (props.loading) return

  isEditing.value = true
  validationError.value = ''

  // Detect country from existing number
  if (props.value) {
    selectedCountry.value = detectCountryFromNumber(props.value)
    const pn = parsePhoneNumber(props.value)
    if (pn.valid && pn.number) {
      // Show national format without country code for editing
      editValue.value = pn.number.national || ''
    } else {
      editValue.value = props.value
    }
  } else {
    editValue.value = ''
  }

  showEdit.value = false

  await nextTick()
  editInput.value?.focus()
  if (editValue.value) {
    editInput.value?.select()
  }

  // Validate initial value
  validatePhoneNumber()
}

function handleCountryChange() {
  // Re-validate with new country
  validatePhoneNumber()
}

function handleCountryBlur(event: FocusEvent) {
  // If we're blurring to focus on the input, don't handle the blur
  if (event?.relatedTarget instanceof HTMLElement) {
    const phoneInputWrapper = (event.currentTarget as HTMLElement)?.closest('.phone-input-wrapper')
    if (phoneInputWrapper?.contains(event.relatedTarget)) {
      return
    }
  }

  // Otherwise, treat it like an input blur
  handleBlur(event)
}

function handleInput() {
  validatePhoneNumber()
}

function validatePhoneNumber() {
  const input = editValue.value.trim()

  if (!input) {
    validationError.value = ''
    isValid.value = false
    formattedNumber.value = ''
    return
  }

  // Try to parse with selected country
  const pn = parsePhoneNumber(input, { regionCode: selectedCountry.value })

  if (pn.valid && pn.number) {
    validationError.value = ''
    isValid.value = true
    formattedNumber.value = pn.number.international || ''
  } else {
    validationError.value = 'Invalid phone number for selected country'
    isValid.value = false
    formattedNumber.value = ''
  }
}

function handleBlur(event?: FocusEvent) {
  if (props.loading) return

  // If we're blurring to focus on the country select, don't handle the blur
  if (event?.relatedTarget && event.currentTarget instanceof HTMLElement) {
    const countrySelect = event.currentTarget.parentElement?.querySelector('.country-select')
    if (event.relatedTarget === countrySelect) {
      return
    }
  }

  // Also check if the related target is within our phone input wrapper
  if (event?.relatedTarget instanceof HTMLElement && event.currentTarget instanceof HTMLElement) {
    const phoneInputWrapper = event.currentTarget.closest('.phone-input-wrapper')
    if (phoneInputWrapper?.contains(event.relatedTarget)) {
      return
    }
  }

  const input = editValue.value.trim()

  // Allow empty values (user can clear the phone number)
  if (!input) {
    emit('update', props.field, '')
    isEditing.value = false
    validationError.value = ''
    return
  }

  // Parse the number with selected country
  const pn = parsePhoneNumber(input, { regionCode: selectedCountry.value })

  if (!pn.valid || !pn.number) {
    validationError.value = 'Please enter a valid phone number'
    // Don't exit edit mode on invalid number
    return
  }

  // Get E.164 format (e.g., +16046985555)
  const e164Number = pn.number.e164

  // Only emit if the value has changed
  if (e164Number !== props.value) {
    emit('update', props.field, e164Number)
  }

  isEditing.value = false
  validationError.value = ''
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    handleBlur()
  } else if (event.key === 'Escape') {
    editValue.value = ''
    isEditing.value = false
    validationError.value = ''
  }
}

// Watch for external value changes
watch(() => props.value, (newValue) => {
  if (!isEditing.value && newValue) {
    selectedCountry.value = detectCountryFromNumber(newValue)
  }
}, { immediate: true })
</script>

<style scoped>
.phone-number-field {
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

.success-message {
  font-size: var(--font-size-xs);
  color: var(--color-success, #22c55e);
  margin-top: var(--space-1);
  padding-left: var(--space-3);
  line-height: 1.2;
}

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
  line-height: 1.4;
  min-height: 1.4rem;
  white-space: pre-wrap;
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

.phone-input-wrapper {
  display: flex;
  gap: var(--space-2);
  flex: 1;
}

.country-select {
  padding: var(--space-3);
  padding-top: var(--space-4);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  min-height: 2.5rem;
  cursor: pointer;
  font-family: inherit;
  width: 90px;
}

.country-select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-alpha);
}

.country-select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
  line-height: 1.25rem;
  box-sizing: border-box;
  font-family: inherit;
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

.edit-input-valid {
  border-color: var(--color-success, #22c55e);
}

.edit-input-valid:focus {
  border-color: var(--color-success, #22c55e);
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.1);
}

/* Prevent mobile zoom on focus */
@media (max-width: 768px) {
  .edit-input,
  .country-select {
    font-size: 16px;
  }
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

  .phone-input-wrapper {
    flex-direction: column;
  }

  .country-select {
    width: 100%;
  }
}
</style>
