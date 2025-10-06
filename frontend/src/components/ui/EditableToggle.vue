<template>
  <div class="editable-field">
    <div
      class="field-display"
      @mouseenter="showEdit = true"
      @mouseleave="showEdit = false"
      @click="toggleValue"
    >
      <span class="field-value">
        <div class="toggle-container">
          <div class="toggle-switch" :class="{ 'toggle-active': value }">
            <div class="toggle-slider" />
          </div>
          <span class="toggle-label">{{ value ? onLabel : offLabel }}</span>
        </div>
      </span>
      <LoadingSpinner v-if="loading" class="spinner-position" />
    </div>

    <div v-if="label" class="field-label">{{ label }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import LoadingSpinner from './LoadingSpinner.vue'

interface Props {
  value: boolean
  field: string
  label?: string
  loading?: boolean
  onLabel?: string
  offLabel?: string
}

interface Emits {
  (e: 'update', field: string, value: boolean): void
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  onLabel: 'Enabled',
  offLabel: 'Disabled',
})

const emit = defineEmits<Emits>()

const showEdit = ref(false)

function toggleValue() {
  if (props.loading) return
  emit('update', props.field, !props.value)
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

/* Fixed height container for display mode */
.field-display {
  min-height: 2.5rem;
  position: relative;
  border-radius: var(--radius-sm);
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
  line-height: 1.25rem;
  min-height: 1.25rem;
}

.toggle-container {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.toggle-switch {
  position: relative;
  width: 44px;
  height: 24px;
  background-color: var(--color-bg-tertiary);
  border-radius: 12px;
  transition: background-color 0.3s ease;
  border: 1px solid var(--color-border);
}

.toggle-switch.toggle-active {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
}

.toggle-slider {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  background-color: white;
  border-radius: 50%;
  transition: transform 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.toggle-active .toggle-slider {
  transform: translateX(20px);
}

.toggle-label {
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
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

.spinner-position {
  position: absolute;
  right: var(--space-2);
  top: 50%;
  transform: translateY(-50%);
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
