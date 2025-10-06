<template>
  <div class="string-list-editor">
    <div class="list-container">
      <TransitionGroup name="list-item" tag="div">
        <div v-for="(item, index) in items" :key="`item-${index}`" class="list-item">
          <BaseInput
            :model-value="item"
            @update:model-value="(value) => updateItem(index, value)"
          />
          <BaseButton variant="danger" size="sm" type="button" @click="removeItem(index)">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M3 6h18"></path>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
              <path d="M8 6V4c0-1 1-2 2-2h4c0 1 1 2 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </BaseButton>
        </div>
      </TransitionGroup>
      <BaseButton variant="outline" size="md" type="button" @click="addItem">
        + {{ addButtonText }}
      </BaseButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import BaseInput from './BaseInput.vue'
import BaseButton from './BaseButton.vue'

interface Props {
  modelValue: string[]
  itemLabel?: string
  addButtonText?: string
}

const props = withDefaults(defineProps<Props>(), {
  addButtonText: 'Add Item',
})

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const items = ref<string[]>([...props.modelValue])

watch(
  () => props.modelValue,
  (newValue) => {
    items.value = [...newValue]
  },
  { deep: true },
)

const addItem = (e: MouseEvent) => {
  e.preventDefault()
  e.stopPropagation()
  items.value.push('')
  emit('update:modelValue', [...items.value])
}

const removeItem = (index: number) => {
  items.value.splice(index, 1)
  emit('update:modelValue', [...items.value])
}

const updateItem = (index: number, value: string) => {
  items.value[index] = value
  emit('update:modelValue', [...items.value])
}
</script>

<style scoped>
.list-container {
  display: flex;
  flex-direction: column;
}

.list-item {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  background: var(--color-bg-primary);
  margin-bottom: var(--space-4);
  overflow: hidden;
  max-height: 100px;
  transition: max-height 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.list-item > :first-child {
  flex: 1;
}

.list-item-enter-active {
  transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.list-item-leave-active {
  transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.list-item-enter-from {
  opacity: 0;
  transform: translateY(-10px);
  max-height: 0;
  margin-bottom: 0;
  padding: 0;
}

.list-item-leave-to {
  opacity: 0;
  transform: translateY(-10px);
  max-height: 0;
  margin-bottom: 0;
  padding: 0;
}

.list-item-move {
  transition: transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}
</style>
