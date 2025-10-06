<template>
  <div class="address-search">
    <div
      v-if="!isEditing"
      class="field-display"
      :class="{ 'field-error': error }"
      @mouseenter="showEdit = true"
      @mouseleave="showEdit = false"
      @click="startEditing"
    >
      <span class="field-value">{{ displayValue }}</span>
      <div v-if="showEdit" class="edit-button" aria-label="Edit address">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
          />
        </svg>
      </div>
    </div>

    <div v-else class="field-edit">
      <div class="search-container">
        <input
          ref="searchInput"
          v-model="searchValue"
          type="text"
          class="search-input"
          :class="{ 'search-input-empty': searchValue.trim() === '' }"
          :placeholder="placeholder"
          @focus="handleFocus"
          @blur="handleBlur"
          @keydown="handleKeydown"
          :disabled="loading"
        />
        <div v-if="suggestions.length > 0" class="suggestions-dropdown">
          <div
            v-for="(suggestion, index) in suggestions"
            :key="suggestion.place_id"
            class="suggestion-item"
            :class="{ active: selectedIndex === index }"
            @click="selectSuggestion(suggestion)"
            @mouseenter="selectedIndex = index"
          >
            <div class="suggestion-main">{{ suggestion.main_text }}</div>
            <div class="suggestion-secondary">{{ suggestion.secondary_text }}</div>
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
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { Loader } from '@googlemaps/js-api-loader'

interface Props {
  value: string
  field: string
  label?: string
  loading?: boolean
  apiKey?: string
  placeholder?: string
  shortCodes?: boolean
  required?: boolean
  error?: string
}

interface Emits {
  (e: 'update', field: string, address: { [key: string]: string | undefined }): void
  (e: 'focus', field: string): void
  (e: 'blur', field: string): void
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  apiKey: '',
  placeholder: 'Search for an address...',
})

const emit = defineEmits<Emits>()

const isEditing = ref(false)
const showEdit = ref(false)
const searchValue = ref('')
const suggestions = ref<
  Array<{ place_id: string; main_text: string; secondary_text: string; description: string }>
>([])
const selectedIndex = ref(-1)
const searchInput = ref<HTMLInputElement>()
let autocompleteService: google.maps.places.AutocompleteService | null = null
let placesService: google.maps.places.PlacesService | null = null
let searchTimeout: ReturnType<typeof setTimeout> | null = null

const displayValue = computed(() => {
  return props.value || ''
})

const apiKey = computed(() => {
  return props.apiKey || import.meta.env.VITE_GOOGLE_PLACES_API_KEY || ''
})

onMounted(async () => {
  if (!apiKey.value) {
    console.warn('Google Places API key not provided')
    return
  }

  try {
    const loader = new Loader({
      apiKey: apiKey.value,
      version: 'weekly',
      libraries: ['places'],
    })

    await loader.load()

    autocompleteService = new google.maps.places.AutocompleteService()

    // Create a div for PlacesService (required but not displayed)
    const placesDiv = document.createElement('div')
    placesService = new google.maps.places.PlacesService(placesDiv)
  } catch (error) {
    console.error('Failed to load Google Places API:', error)
  }
})

onUnmounted(() => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
})

watch(
  () => props.value,
  () => {
    showEdit.value = false
  },
)

function parseManualAddress(addressString: string) {
  if (!addressString.trim()) {
    return {
      line_1: '',
      city: '',
      state: '',
      country: '',
      postal_code: '',
    }
  }

  // Try to intelligently parse a manually entered address
  // Common formats: "123 Main St, City, State 12345", "123 Main St, City, State", etc.
  const parts = addressString.split(',').map((part) => part.trim())

  let line_1 = ''
  let city = ''
  let state = ''
  let postal_code = ''
  let country = ''

  if (parts.length >= 1) {
    line_1 = parts[0] // First part is usually the street address
  }

  if (parts.length >= 2) {
    city = parts[1] // Second part is usually the city
  }

  if (parts.length >= 3) {
    // Third part might be "State ZIP" or just "State"
    const stateZipPart = parts[2].trim()

    // Try to extract ZIP code (common patterns: 5 digits, 5+4 digits, postal codes)
    const zipMatch = stateZipPart.match(/(\b\d{5}(-\d{4})?\b|\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b)/i)

    if (zipMatch) {
      postal_code = zipMatch[1].replace(/\s/g, '').toUpperCase()
      // Remove the ZIP from the state part
      state = stateZipPart.replace(zipMatch[0], '').trim()
    } else {
      state = stateZipPart
    }
  }

  if (parts.length >= 4) {
    // Fourth part might be country or additional state info
    const fourthPart = parts[3].trim()
    // If no postal code was found yet, check if this part contains one
    if (!postal_code) {
      const zipMatch = fourthPart.match(/(\b\d{5}(-\d{4})?\b|\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b)/i)
      if (zipMatch) {
        postal_code = zipMatch[1].replace(/\s/g, '').toUpperCase()
        country = fourthPart.replace(zipMatch[0], '').trim()
      } else {
        country = fourthPart
      }
    } else {
      country = fourthPart
    }
  }

  if (parts.length >= 5) {
    // Fifth part is likely country
    country = parts[4].trim()
  }

  // Default country to 'US' if not specified and looks like a US format
  if (!country && postal_code && /^\d{5}(-\d{4})?$/.test(postal_code)) {
    country = 'US'
  }

  return {
    line_1,
    city,
    state,
    country,
    postal_code,
  }
}

async function startEditing() {
  if (props.loading) return

  isEditing.value = true
  searchValue.value = props.value || ''
  showEdit.value = false
  suggestions.value = []
  selectedIndex.value = -1

  await nextTick()
  searchInput.value?.focus()
  if (props.value) {
    searchInput.value?.select()
  }
}

function handleFocus() {
  emit('focus', props.field)
}

function handleBlur() {
  // Delay hiding suggestions to allow for clicks
  setTimeout(() => {
    if (props.loading) return

    suggestions.value = []
    selectedIndex.value = -1

    // If no selection was made and input is different from original
    if (searchValue.value !== props.value) {
      // Treat as manual address entry and try to parse it
      const manualAddress = parseManualAddress(searchValue.value)
      emit('update', props.field, manualAddress)
    }

    isEditing.value = false
    emit('blur', props.field)
  }, 150)
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    selectedIndex.value = Math.min(selectedIndex.value + 1, suggestions.value.length - 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    selectedIndex.value = Math.max(selectedIndex.value - 1, -1)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    if (selectedIndex.value >= 0 && suggestions.value[selectedIndex.value]) {
      selectSuggestion(suggestions.value[selectedIndex.value])
    } else {
      handleBlur()
    }
  } else if (event.key === 'Escape') {
    searchValue.value = props.value || ''
    suggestions.value = []
    isEditing.value = false
  } else {
    // Search for places as user types
    if (searchTimeout) {
      clearTimeout(searchTimeout)
    }

    searchTimeout = setTimeout(() => {
      searchPlaces(searchValue.value)
    }, 300) as ReturnType<typeof setTimeout>
  }
}

function searchPlaces(query: string) {
  if (!autocompleteService || !query.trim()) {
    suggestions.value = []
    return
  }

  const request = {
    input: query,
    types: ['address'],
    componentRestrictions: { country: ['US', 'CA', 'GB', 'AU'] }, // Adjust countries as needed
  }

  autocompleteService.getPlacePredictions(request, (predictions, status) => {
    if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
      suggestions.value = predictions.map((prediction) => ({
        place_id: prediction.place_id,
        main_text: prediction.structured_formatting?.main_text || prediction.description,
        secondary_text: prediction.structured_formatting?.secondary_text || '',
        description: prediction.description,
      }))
      selectedIndex.value = -1
    } else {
      suggestions.value = []
    }
  })
}

function selectSuggestion(suggestion: {
  place_id: string
  main_text: string
  secondary_text: string
  description: string
}) {
  if (!placesService) return

  const request = {
    placeId: suggestion.place_id,
    fields: ['address_components', 'formatted_address', 'geometry'],
  }

  placesService.getDetails(request, (place, status) => {
    if (status === google.maps.places.PlacesServiceStatus.OK && place) {
      const addressComponents = place.address_components || []
      const getComponent = (type: string) => {
        const component = addressComponents.find((comp) => comp.types.includes(type))
        if (props.shortCodes && component) {
          return component.short_name
        }
        return component?.long_name || ''
      }

      const address = {
        line_1: `${getComponent('street_number')} ${getComponent('route')}`.trim(),
        line_2: getComponent('subpremise') || undefined,
        city: getComponent('locality') || getComponent('administrative_area_level_2'),
        state: getComponent('administrative_area_level_1'),
        country: getComponent('country'),
        postal_code: getComponent('postal_code'),
        formatted_address: place.formatted_address,
      }

      // When shortCodes is enabled, reconstruct the display value using the same format
      // that will be stored, so the comparison on line 191 works correctly
      if (props.shortCodes) {
        const parts = []
        if (address.line_1) parts.push(address.line_1)
        if (address.city) parts.push(address.city)
        if (address.state) parts.push(address.state)
        if (address.postal_code) parts.push(address.postal_code)
        if (address.country) parts.push(address.country)
        searchValue.value = parts.filter(Boolean).join(', ')
      } else {
        searchValue.value = place.formatted_address || suggestion.description
      }

      suggestions.value = []
      isEditing.value = false

      emit('update', props.field, address)
    }
  })
}
</script>

<style scoped>
.address-search {
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

.search-container {
  flex: 1;
  position: relative;
}

.search-input {
  width: 100%;
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
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-alpha);
}

.search-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.search-input-empty {
  border-color: var(--color-border);
}

.search-input-empty:focus {
  border-color: var(--color-primary);
}

.suggestions-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-top: none;
  border-radius: 0 0 var(--radius-md) var(--radius-md);
  max-height: 200px;
  overflow-y: auto;
  z-index: 1000;
  box-shadow: var(--shadow-lg);
}

.suggestion-item {
  padding: var(--space-3);
  cursor: pointer;
  border-bottom: 1px solid var(--color-border);
  transition: background-color 0.2s ease;
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-item:hover,
.suggestion-item.active {
  background: var(--color-bg-muted);
}

.suggestion-main {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
  margin-bottom: var(--space-1);
}

.suggestion-secondary {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
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
