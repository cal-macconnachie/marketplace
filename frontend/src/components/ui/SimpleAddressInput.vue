<template>
  <div class="simple-address-input">
    <div class="search-container">
      <input
        ref="searchInput"
        v-model="searchValue"
        type="text"
        class="search-input"
        :class="{ 'search-input-error': error }"
        :placeholder="placeholder"
        :disabled="disabled"
        :required="required"
        :autocomplete="autocomplete"
        :tabindex="tabindex"
        @focus="handleFocus"
        @blur="handleBlur"
        @keydown="handleKeydown"
        @input="handleInput"
      />
      <label
        v-if="label"
        class="input-label"
        :class="{ 'label-focused': isFocused || searchValue, 'label-error': error }"
      >
        {{ label }}
      </label>
      <div v-if="suggestions.length > 0" class="suggestions-dropdown">
        <div
          v-for="(suggestion, index) in suggestions"
          :key="suggestion.place_id"
          class="suggestion-item"
          :class="{ active: selectedIndex === index }"
          @mousedown.prevent="selectSuggestion(suggestion)"
          @touchstart.prevent="selectSuggestion(suggestion)"
          @mouseenter="selectedIndex = index"
        >
          <div class="suggestion-main">{{ suggestion.main_text }}</div>
          <div class="suggestion-secondary">{{ suggestion.secondary_text }}</div>
        </div>
      </div>
    </div>

    <div v-if="error" class="error-message">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { Loader } from '@googlemaps/js-api-loader'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

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
  (e: 'update', field: string, address: { [key: string]: string | undefined }): void
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  placeholder: 'Search for an address...',
  autocomplete: 'street-address',
  required: false,
})

const emit = defineEmits<Emits>()

const isFocused = ref(false)
const searchValue = ref(props.modelValue || '')
const suggestions = ref<
  Array<{ place_id: string; main_text: string; secondary_text: string; description: string }>
>([])
const selectedIndex = ref(-1)
const searchInput = ref<HTMLInputElement>()
let autocompleteService: google.maps.places.AutocompleteService | null = null
let placesService: google.maps.places.PlacesService | null = null
let searchTimeout: ReturnType<typeof setTimeout> | null = null

const apiKey = computed(() => {
  return import.meta.env.VITE_GOOGLE_PLACES_API_KEY || ''
})

// Sync searchValue with modelValue
watch(
  () => props.modelValue,
  (newValue) => {
    searchValue.value = newValue || ''
  },
)

// Emit updates
watch(searchValue, (newValue) => {
  emit('update:modelValue', newValue)
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

function handleFocus() {
  isFocused.value = true
}

function handleBlur() {
  // Delay hiding suggestions to allow for clicks
  setTimeout(() => {
    isFocused.value = false
    suggestions.value = []
    selectedIndex.value = -1
  }, 150)
}

function handleInput() {
  // Search for places as user types
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  searchTimeout = setTimeout(() => {
    searchPlaces(searchValue.value)
  }, 300) as ReturnType<typeof setTimeout>
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
    }
  } else if (event.key === 'Escape') {
    suggestions.value = []
    searchInput.value?.blur()
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
    componentRestrictions: { country: ['US', 'CA', 'GB', 'AU'] },
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
    fields: ['address_components', 'formatted_address'],
  }

  placesService.getDetails(request, (place, status) => {
    if (status === google.maps.places.PlacesServiceStatus.OK && place) {
      const addressComponents = place.address_components || []
      const getComponent = (type: string) => {
        const component = addressComponents.find((comp) => comp.types.includes(type))
        return component?.long_name || ''
      }

      const address = {
        line_1: `${getComponent('street_number')} ${getComponent('route')}`.trim(),
        line_2: getComponent('subpremise') || undefined,
        city: getComponent('locality') || getComponent('administrative_area_level_2'),
        state: getComponent('administrative_area_level_1'),
        country: getComponent('country'),
        postal_code: getComponent('postal_code'),
      }

      searchValue.value = place.formatted_address || suggestion.description
      suggestions.value = []

      emit('update', props.field, address)
    }
  })
}
</script>

<style scoped>
.simple-address-input {
  position: relative;
  flex: 1;
  min-width: 0;
  width: 100%;
}

.search-container {
  position: relative;
  width: 100%;
}

.search-input {
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

.search-input:hover:not(:disabled) {
  border-color: var(--color-border-hover);
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-alpha);
}

.search-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: var(--color-bg-muted);
}

.search-input-error {
  border-color: var(--color-error, #ef4444);
}

.search-input-error:focus {
  border-color: var(--color-error, #ef4444);
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.1);
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

/* Prevent mobile zoom on focus */
@media (max-width: 768px) {
  .search-input {
    font-size: 16px;
  }
}

.suggestions-dropdown {
  position: absolute;
  top: calc(100% + 1px);
  left: 0;
  right: 0;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  max-height: 200px;
  overflow-y: auto;
  z-index: 10000;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  margin-top: 4px;
  -webkit-overflow-scrolling: touch;
}

@media (max-width: 768px) {
  .suggestions-dropdown {
    max-height: 250px;
  }
}

.suggestion-item {
  padding: var(--space-3);
  cursor: pointer;
  border-bottom: 1px solid var(--color-border);
  transition: background-color 0.2s ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-item:hover,
.suggestion-item.active {
  background: var(--color-bg-muted);
}

@media (max-width: 768px) {
  .suggestion-item {
    padding: var(--space-4);
    min-height: 48px;
  }
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
</style>
