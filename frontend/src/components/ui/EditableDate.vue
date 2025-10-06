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
      <div class="date-wrapper">
        <div
          ref="editInput"
          class="edit-input date-display"
          :class="{ 'edit-input-empty': editValue === '', 'edit-input-error': error }"
          @click="toggleCalendar"
          @keydown="handleKeydown"
          tabindex="0"
        >
          {{ selectedDateDisplay || placeholder }}
        </div>

        <div v-if="showCalendar" class="calendar-overlay" @click.self="closeCalendar">
          <div class="calendar-container" :style="calendarStyle">
            <div class="calendar-header">
              <button type="button" class="calendar-nav" @click.stop.prevent="previousMonth">
                ‹
              </button>
              <div class="calendar-month-year">
                <span class="month-selector" @click.stop="showMonthPicker = true">
                  {{ currentMonthName }}
                </span>
                <span class="year-selector" @click.stop="showYearPicker = true">
                  {{ currentYear }}
                </span>
              </div>
              <button type="button" class="calendar-nav" @click.stop.prevent="nextMonth">›</button>
            </div>

            <div class="calendar-weekdays">
              <div v-for="day in weekDays" :key="day" class="calendar-weekday">
                {{ day }}
              </div>
            </div>

            <div class="calendar-days">
              <div
                v-for="(day, index) in calendarDays"
                :key="index"
                class="calendar-day"
                :class="{
                  'day-empty': !day,
                  'day-selected': day && isSelectedDate(day),
                  'day-today': day && isToday(day),
                  'day-disabled': day && isDisabled(day),
                }"
                @click="day && !isDisabled(day) && selectDate(day)"
              >
                {{ day || '' }}
              </div>
            </div>

            <div class="calendar-footer">
              <button type="button" class="calendar-today-btn" @click.stop="selectToday">
                Today
              </button>
            </div>

            <!-- Month Picker -->
            <div v-if="showMonthPicker" class="picker-overlay">
              <div class="month-picker-container">
                <div class="month-picker-grid">
                  <div
                    v-for="(month, index) in monthNames"
                    :key="index"
                    class="month-item"
                    :class="{ 'month-selected': index === currentMonth }"
                    @click.stop="selectMonth(index)"
                  >
                    {{ month }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Year Picker -->
            <div v-if="showYearPicker" class="picker-overlay">
              <div class="year-picker-container">
                <div class="year-picker-header">
                  <button type="button" class="year-nav" @click.stop="yearRangeBack">‹</button>
                  <span class="year-range">{{ yearRangeStart }} - {{ yearRangeEnd }}</span>
                  <button type="button" class="year-nav" @click.stop="yearRangeForward">›</button>
                </div>
                <div class="year-picker-grid">
                  <div
                    v-for="year in yearRange"
                    :key="year"
                    class="year-item"
                    :class="{ 'year-selected': year === currentYear }"
                    @click.stop="selectYear(year)"
                  >
                    {{ year }}
                  </div>
                </div>
              </div>
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
import { ref, nextTick, computed, reactive } from 'vue'

interface Props {
  value: string
  field: string
  label?: string
  loading?: boolean
  placeholder?: string
  minDate?: string
  maxDate?: string
  error?: string
}

interface Emits {
  (e: 'update', field: string, value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  placeholder: 'Select a date',
})

const emit = defineEmits<Emits>()

const isEditing = ref(false)
const showEdit = ref(false)
const editValue = ref('')
const editInput = ref<HTMLDivElement>()
const showCalendar = ref(false)
const calendarStyle = reactive({
  top: '0px',
  left: '0px',
  width: '0px',
})

const currentMonth = ref(new Date().getMonth())
const currentYear = ref(new Date().getFullYear())
const showMonthPicker = ref(false)
const showYearPicker = ref(false)
const yearRangeStart = ref(new Date().getFullYear() - 5)

const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const monthNames = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

const displayValue = computed(() => {
  if (!props.value) return ''

  // Parse date as local timezone (YYYY-MM-DD format)
  const date = new Date(props.value + 'T00:00:00')
  if (!isNaN(date.getTime())) {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return props.value
})

const selectedDateDisplay = computed(() => {
  if (!editValue.value) return ''

  // Parse date as local timezone (YYYY-MM-DD format)
  const date = new Date(editValue.value + 'T00:00:00')
  if (!isNaN(date.getTime())) {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return ''
})

const currentMonthName = computed(() => {
  const date = new Date(currentYear.value, currentMonth.value)
  return date.toLocaleDateString('en-US', { month: 'long' })
})

const yearRangeEnd = computed(() => yearRangeStart.value + 11)

const yearRange = computed(() => {
  const years = []
  for (let i = yearRangeStart.value; i <= yearRangeEnd.value; i++) {
    years.push(i)
  }
  return years
})

const calendarDays = computed(() => {
  const firstDay = new Date(currentYear.value, currentMonth.value, 1)
  const lastDay = new Date(currentYear.value, currentMonth.value + 1, 0)
  const startPadding = firstDay.getDay()
  const daysInMonth = lastDay.getDate()

  const days: (number | null)[] = []

  for (let i = 0; i < startPadding; i++) {
    days.push(null)
  }

  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i)
  }

  while (days.length < 42) {
    days.push(null)
  }

  return days.slice(0, 42)
})

async function startEditing() {
  if (props.loading) return

  isEditing.value = true
  editValue.value = props.value || ''
  showEdit.value = false

  if (props.value) {
    // Parse date as local timezone for calendar display
    const date = new Date(props.value + 'T00:00:00')
    if (!isNaN(date.getTime())) {
      currentMonth.value = date.getMonth()
      currentYear.value = date.getFullYear()
    }
  } else {
    const today = new Date()
    currentMonth.value = today.getMonth()
    currentYear.value = today.getFullYear()
  }

  await nextTick()
  editInput.value?.focus()
  updateCalendarPosition()
  showCalendar.value = true
}

function updateCalendarPosition() {
  if (!editInput.value) return

  const rect = editInput.value.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom
  const spaceAbove = rect.top

  if (spaceBelow >= 350 || spaceBelow > spaceAbove) {
    calendarStyle.top = `${rect.bottom + 2}px`
  } else {
    calendarStyle.top = `${rect.top - 350}px`
  }

  calendarStyle.left = `${rect.left}px`
  calendarStyle.width = `${Math.max(rect.width, 280)}px`
}

function toggleCalendar() {
  if (!showCalendar.value) {
    updateCalendarPosition()
  }
  showCalendar.value = !showCalendar.value
}

function closeCalendar() {
  showCalendar.value = false
  showMonthPicker.value = false
  showYearPicker.value = false
  isEditing.value = false
}

function selectDate(day: number) {
  // Create date in user's local timezone
  const selectedDate = new Date(currentYear.value, currentMonth.value, day)

  // Format as YYYY-MM-DD in local timezone
  const year = selectedDate.getFullYear()
  const month = String(selectedDate.getMonth() + 1).padStart(2, '0')
  const dayStr = String(selectedDate.getDate()).padStart(2, '0')
  const isoDate = `${year}-${month}-${dayStr}`

  editValue.value = isoDate

  const originalValue = props.value || ''
  if (isoDate !== originalValue) {
    emit('update', props.field, isoDate)
  }

  showCalendar.value = false
  isEditing.value = false
}

function selectToday() {
  // Get today in user's local timezone
  const today = new Date()

  // Format as YYYY-MM-DD in local timezone
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  const isoDate = `${year}-${month}-${day}`

  editValue.value = isoDate

  const originalValue = props.value || ''
  if (isoDate !== originalValue) {
    emit('update', props.field, isoDate)
  }

  showCalendar.value = false
  isEditing.value = false
}

function previousMonth(event: MouseEvent) {
  event.stopPropagation()
  event.preventDefault()
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  } else {
    currentMonth.value--
  }
}

function nextMonth(event: MouseEvent) {
  event.stopPropagation()
  event.preventDefault()
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  } else {
    currentMonth.value++
  }
}

function isSelectedDate(day: number): boolean {
  if (!editValue.value) return false

  // Parse date as local timezone for comparison
  const date = new Date(editValue.value + 'T00:00:00')
  return (
    date.getDate() === day &&
    date.getMonth() === currentMonth.value &&
    date.getFullYear() === currentYear.value
  )
}

function isToday(day: number): boolean {
  const today = new Date()
  return (
    today.getDate() === day &&
    today.getMonth() === currentMonth.value &&
    today.getFullYear() === currentYear.value
  )
}

function isDisabled(day: number): boolean {
  // Create date in local timezone
  const date = new Date(currentYear.value, currentMonth.value, day)

  // Format as YYYY-MM-DD for comparison
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const dayStr = String(date.getDate()).padStart(2, '0')
  const isoDate = `${year}-${month}-${dayStr}`

  if (props.minDate && isoDate < props.minDate) return true
  if (props.maxDate && isoDate > props.maxDate) return true

  return false
}

function selectMonth(monthIndex: number) {
  currentMonth.value = monthIndex
  showMonthPicker.value = false
}

function selectYear(year: number) {
  currentYear.value = year
  showYearPicker.value = false
  // Update year range to include selected year
  if (year < yearRangeStart.value || year > yearRangeEnd.value) {
    yearRangeStart.value = year - 5
  }
}

function yearRangeBack() {
  yearRangeStart.value -= 12
}

function yearRangeForward() {
  yearRangeStart.value += 12
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    if (showCalendar.value) {
      showCalendar.value = false
    } else {
      showCalendar.value = true
    }
  } else if (event.key === 'Escape') {
    editValue.value = props.value || ''
    showCalendar.value = false
    showMonthPicker.value = false
    showYearPicker.value = false
    isEditing.value = false
  } else if (event.key === ' ') {
    event.preventDefault()
    showCalendar.value = true
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
  line-height: 1.25rem;
  min-height: 1.25rem;
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
  line-height: 1.25rem;
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

.date-wrapper {
  position: relative;
  flex: 1;
}

.date-display {
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
}

.date-display::after {
  position: absolute;
  right: var(--space-3);
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  pointer-events: none;
}

.calendar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
}

.calendar-container {
  position: fixed;
  min-width: 280px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
  z-index: 1000;
  padding: var(--space-3);
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
  padding: 0 var(--space-2);
}

.calendar-nav {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  font-size: 1.25rem;
  cursor: pointer;
  padding: var(--space-1) var(--space-2);
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.calendar-nav:hover {
  background-color: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.calendar-month-year {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.month-selector,
.year-selector {
  cursor: pointer;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.month-selector:hover,
.year-selector:hover {
  background-color: var(--color-bg-secondary);
  border-color: var(--color-border);
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0;
  margin-bottom: var(--space-2);
}

.calendar-weekday {
  text-align: center;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  padding: var(--space-1);
}

.calendar-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  padding: var(--space-2) 0;
}

.calendar-day {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.15s ease;
}

.calendar-day:not(.day-empty):not(.day-disabled):hover {
  background-color: var(--color-bg-secondary);
}

.day-empty {
  cursor: default;
}

.day-selected {
  background-color: var(--color-primary);
  color: white;
  font-weight: var(--font-weight-medium);
}

.day-selected:hover {
  background-color: var(--color-primary) !important;
  transform: scale(1.1);
}

.day-today {
  position: relative;
  font-weight: var(--font-weight-medium);
}

.day-today::after {
  content: '';
  position: absolute;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  height: 4px;
  background-color: var(--color-primary);
  border-radius: 50%;
}

.day-selected.day-today::after {
  background-color: white;
}

.day-disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.day-disabled:hover {
  background-color: transparent !important;
}

.calendar-footer {
  margin-top: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: center;
}

.calendar-today-btn {
  background: transparent;
  border: none;
  color: var(--color-primary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s ease;
}

.calendar-today-btn:hover {
  background-color: var(--color-bg-secondary);
  color: var(--color-primary);
}

.picker-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-bg-primary);
  border-radius: var(--radius-sm);
  padding: var(--space-3);
  z-index: 10;
  animation: fadeIn 0.15s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.month-picker-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.month-picker-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
  flex: 1;
  align-content: center;
}

.month-item {
  padding: var(--space-4) var(--space-2);
  text-align: center;
  cursor: pointer;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  transition: all 0.15s ease;
  border: 1px solid transparent;
}

.month-item:hover {
  background-color: var(--color-bg-secondary);
}

.month-selected {
  background-color: var(--color-primary);
  color: white;
  font-weight: var(--font-weight-medium);
}

.month-selected:hover {
  background-color: var(--color-primary);
}

.year-picker-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.year-picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
  padding: var(--space-2);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.year-nav {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  font-size: 1.25rem;
  cursor: pointer;
  padding: var(--space-1) var(--space-2);
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.year-nav:hover {
  background-color: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.year-range {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.year-picker-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
  flex: 1;
  align-content: center;
}

.year-item {
  padding: var(--space-4) var(--space-2);
  text-align: center;
  cursor: pointer;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.year-item:hover {
  background-color: var(--color-bg-secondary);
}

.year-selected {
  background-color: var(--color-primary);
  color: white;
  font-weight: var(--font-weight-medium);
}

.year-selected:hover {
  background-color: var(--color-primary);
}

@media (max-width: 640px) {
  .field-value {
    padding-right: var(--space-8);
  }

  .edit-button {
    opacity: 1;
  }
}
</style>
