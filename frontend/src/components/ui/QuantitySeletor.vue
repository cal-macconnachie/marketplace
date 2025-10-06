<template>
  <div :class="['quantity-input-wrapper', `quantity-input-wrapper--${size}`]">
    <button
      @click="quantity--"
      :disabled="quantity <= min"
      :class="['quantity-btn', 'quantity-btn--minus', `quantity-btn--${size}`]"
      aria-label="Decrease quantity"
    >
      −
    </button>
    <input
      id="quantity"
      v-model.number="quantity"
      :disabled="!allowInput"
      type="number"
      :min="min"
      :max="max"
      :class="['quantity-input', `quantity-input--${size}`]"
    />
    <button
      @click="quantity++"
      :disabled="quantity >= max"
      :class="['quantity-btn', 'quantity-btn--plus', `quantity-btn--${size}`]"
      aria-label="Increase quantity"
    >
      +
    </button>
  </div>
</template>
<script setup lang="ts">
import { watch } from 'vue'

const props = defineProps({
  max: {
    type: Number,
    default: 99,
  },
  min: {
    type: Number,
    default: 0,
  },
  size: {
    type: String,
    default: 'md',
  },
  allowInput: {
    type: Boolean,
    default: true,
  },
})
const quantity = defineModel({
  type: Number,
  default: 0,
})
watch(quantity, (newValue) => {
  if (newValue < props.min) {
    quantity.value = props.min
  } else if (newValue > props.max) {
    quantity.value = props.max
  }
})
</script>
<style>
.quantity-input-wrapper {
  display: flex;
  align-items: center;
  gap: 0;
  width: fit-content;
  opacity: 1;
  visibility: visible;
  transition:
    opacity 0.2s ease,
    visibility 0.2s ease;
}

.quantity-input-wrapper--hidden {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

.quantity-btn {
  width: 40px;
  height: 40px;
  border: 2px solid var(--color-border);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  cursor: pointer;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  user-select: none;
}

.quantity-btn:hover:not(:disabled) {
  background: var(--color-bg-secondary);
}

.quantity-btn:disabled {
  cursor: not-allowed;
}

.quantity-btn--minus {
  border-radius: var(--radius-md) 0 0 var(--radius-md);
  border-right: none;
}

.quantity-btn--plus {
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  border-left: none;
}

.quantity-input {
  width: 60px;
  height: 40px;
  border: 2px solid var(--color-border);
  border-left: none;
  border-right: none;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  text-align: center;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  outline: none;
}

.quantity-input::-webkit-outer-spin-button,
.quantity-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.quantity-input[type='number'] {
  -moz-appearance: textfield;
  appearance: textfield;
}

/* Size variants */
.quantity-btn--xs {
  width: 24px;
  height: 24px;
  font-size: var(--font-size-sm);
}

.quantity-input--xs {
  width: 32px;
  height: 24px;
  font-size: calc(var(--font-size-sm) * 3 / 4);
}

.quantity-btn--sm {
  width: 32px;
  height: 32px;
  font-size: var(--font-size-base);
}

.quantity-input--sm {
  width: 48px;
  height: 32px;
  font-size: var(--font-size-sm);
}

.quantity-btn--md {
  width: 40px;
  height: 40px;
  font-size: var(--font-size-lg);
}

.quantity-input--md {
  width: 60px;
  height: 40px;
  font-size: var(--font-size-base);
}

.quantity-btn--lg {
  width: 48px;
  height: 48px;
  font-size: var(--font-size-xl);
}

.quantity-input--lg {
  width: 72px;
  height: 48px;
  font-size: var(--font-size-lg);
}
</style>
