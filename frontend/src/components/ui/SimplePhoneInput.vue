<template>
  <div class="simple-phone-input">
    <div class="phone-input-wrapper">
      <select
        v-model="selectedCountry"
        class="country-select"
        :disabled="disabled"
        @change="handleCountryChange"
        :tabindex="tabindex"
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
      <div class="input-container">
        <input
          ref="phoneInput"
          v-model="localValue"
          class="phone-input"
          :class="{
            'input-error': error || validationError,
            'input-valid': isValid && localValue.trim() !== ''
          }"
          @blur="handleBlur"
          @focus="handleFocus"
          @input="handleInput"
          :disabled="disabled"
          :placeholder="placeholderText"
          :required="required"
          :autocomplete="autocomplete"
          :tabindex="tabindex ? tabindex + 0.1 : undefined"
          type="tel"
        />
        <label
          v-if="label"
          class="input-label"
          :class="{ 'label-focused': isFocused || localValue, 'label-error': error || validationError }"
        >
          {{ label }}
        </label>
      </div>
    </div>

    <div v-if="error || validationError" class="error-message">
      {{ error || validationError }}
    </div>
    <div v-else-if="localValue && isValid && formattedNumber" class="success-message">
      {{ formattedNumber }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { parsePhoneNumber } from 'awesome-phonenumber'
import { computed, ref, watch } from 'vue'

interface Props {
  modelValue: string
  field: string
  label?: string
  disabled?: boolean
  placeholder?: string
  required?: boolean
  error?: string
  autocomplete?: string
  tabindex?: number
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'update', field: string, value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  placeholder: '',
  required: false,
  autocomplete: 'tel',
})

const emit = defineEmits<Emits>()

const isFocused = ref(false)
const localValue = ref('')
const selectedCountry = ref('CA')
const phoneInput = ref<HTMLInputElement>()
const validationError = ref('')
const isValid = ref(false)
const formattedNumber = ref('')

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

  return 'CA'
}

// Initialize from modelValue
watch(() => props.modelValue, (newValue) => {
  if (newValue) {
    selectedCountry.value = detectCountryFromNumber(newValue)
    const pn = parsePhoneNumber(newValue)
    if (pn.valid && pn.number) {
      localValue.value = pn.number.national || ''
    } else {
      localValue.value = newValue
    }
  } else {
    localValue.value = ''
  }
  validatePhoneNumber()
}, { immediate: true })

function handleCountryChange() {
  validatePhoneNumber()
}

function handleFocus() {
  isFocused.value = true
}

function handleInput() {
  validatePhoneNumber()
}

function validatePhoneNumber() {
  const input = localValue.value.trim()

  if (!input) {
    validationError.value = ''
    isValid.value = false
    formattedNumber.value = ''
    return
  }

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

function handleBlur() {
  isFocused.value = false

  const input = localValue.value.trim()

  // Allow empty values
  if (!input) {
    emit('update:modelValue', '')
    emit('update', props.field, '')
    validationError.value = ''
    return
  }

  // Parse the number with selected country
  const pn = parsePhoneNumber(input, { regionCode: selectedCountry.value })

  if (!pn.valid || !pn.number) {
    validationError.value = 'Please enter a valid phone number'
    return
  }

  // Get E.164 format (e.g., +16046985555)
  const e164Number = pn.number.e164

  // Emit if changed
  if (e164Number !== props.modelValue) {
    emit('update:modelValue', e164Number)
    emit('update', props.field, e164Number)
  }

  validationError.value = ''
}
</script>

<style scoped>
.simple-phone-input {
  position: relative;
  flex: 1;
  min-width: 0;
  width: 100%;
}

.phone-input-wrapper {
  display: flex;
  gap: var(--space-2);
  width: 100%;
}

.country-select {
  padding: var(--space-3);
  padding-top: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  min-height: calc(1.5 * var(--font-size-sm) + var(--space-4) + var(--space-3) + 2px);
  cursor: pointer;
  font-family: inherit;
  width: 90px;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.country-select:hover:not(:disabled) {
  border-color: var(--color-border-hover);
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

.input-container {
  position: relative;
  flex: 1;
  min-width: 0;
}

.phone-input {
  width: 100%;
  padding: var(--space-3);
  padding-top: var(--space-4);
  padding-bottom: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  text-align: left;
  line-height: 1.5;
  min-height: calc(1.5 * var(--font-size-sm) + var(--space-4) + var(--space-3) + 2px);
  box-sizing: border-box;
  font-family: inherit;
  transition: all 0.2s ease;
}

.phone-input:hover:not(:disabled) {
  border-color: var(--color-border-hover);
}

.phone-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-alpha);
}

.phone-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: var(--color-bg-muted);
}

.input-error {
  border-color: var(--color-error, #ef4444);
}

.input-error:focus {
  border-color: var(--color-error, #ef4444);
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.1);
}

.input-valid {
  border-color: var(--color-success, #22c55e);
}

.input-valid:focus {
  border-color: var(--color-success, #22c55e);
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.1);
}

.input-label {
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
  pointer-events: none;
}

.label-focused {
  color: var(--color-primary);
}

.label-error {
  color: var(--color-error, #ef4444);
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

/* Prevent mobile zoom on focus */
@media (max-width: 768px) {
  .phone-input,
  .country-select {
    font-size: 16px;
  }
}

/* Responsive design */
@media (max-width: 640px) {
  .phone-input-wrapper {
    flex-direction: column;
  }

  .country-select {
    width: 100%;
  }
}
</style>
