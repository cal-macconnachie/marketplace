<template>
  <div class="checkout-progress">
    <div class="progress-steps">
      <div
        v-for="(step, index) in steps"
        :key="step.id"
        class="progress-step"
        :class="{
          'is-completed': index < currentStepIndex,
          'is-current': index === currentStepIndex,
          'is-pending': index > currentStepIndex,
        }"
      >
        <div class="step-indicator">
          <div class="step-circle">
            <svg
              v-if="index < currentStepIndex"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <LoadingSpinner v-else-if="index === currentStepIndex && step.loading" size="16" />
            <span v-else class="step-number">{{ index + 1 }}</span>
          </div>
          <div v-if="index < steps.length - 1" class="step-line"></div>
        </div>
        <div class="step-content">
          <div class="step-label">{{ step.label }}</div>
          <div v-if="step.description && index === currentStepIndex" class="step-description">
            {{ step.description }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import LoadingSpinner from './LoadingSpinner.vue'

interface Step {
  id: string
  label: string
  description?: string
  loading?: boolean
}

interface Props {
  steps: Step[]
  currentStep: string
}

const props = defineProps<Props>()

const currentStepIndex = computed(() => {
  return props.steps.findIndex((step) => step.id === props.currentStep)
})
</script>

<style scoped>
.checkout-progress {
  width: 100%;
  margin-bottom: var(--space-6);
}

.progress-steps {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.progress-step {
  display: flex;
  gap: var(--space-3);
  position: relative;
}

.step-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
}

.step-circle {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-sm);
  transition: all 0.3s ease;
  border: 2px solid var(--color-border);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
}

.progress-step.is-completed .step-circle {
  background: var(--color-success);
  border-color: var(--color-success);
  color: white;
}

.progress-step.is-current .step-circle {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.step-line {
  width: 2px;
  flex: 1;
  background: var(--color-border);
  margin: var(--space-1) 0;
  transition: background-color 0.3s ease;
}

.progress-step.is-completed .step-line {
  background: var(--color-success);
}

.step-content {
  flex: 1;
  padding-top: var(--space-1);
}

.step-label {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  transition: color 0.3s ease;
}

.progress-step.is-current .step-label {
  color: var(--color-text-primary);
}

.progress-step.is-completed .step-label {
  color: var(--color-success);
}

.step-description {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin-top: var(--space-1);
  line-height: var(--line-height-relaxed);
}

.step-number {
  font-size: var(--font-size-sm);
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .progress-steps {
    gap: var(--space-3);
  }

  .step-circle {
    width: 28px;
    height: 28px;
  }
}
</style>
