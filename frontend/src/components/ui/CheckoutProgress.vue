<template>
  <div class="checkout-progress">
    <div class="progress-steps">
      <template v-for="(step, index) in steps" :key="step.id">
        <div
          class="progress-step"
          :class="{
            'is-completed': index < currentStepIndex || currentStep === 'complete',
            'is-current': index === currentStepIndex && currentStep !== 'complete',
            'is-pending': index > currentStepIndex,
          }"
        >
          <div class="step-indicator">
            <div class="step-circle">
              <svg
                v-if="index < currentStepIndex || currentStep === 'complete'"
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
          </div>
          <div class="step-content">
            <div class="step-label">{{ step.label }}</div>
            <div
              class="step-description"
              :class="{ 'is-visible': step.description && index === currentStepIndex }"
            >
              {{ step.description || '\u00A0' }}
            </div>
          </div>
        </div>
        <!-- Connector line between steps -->
        <div v-if="index < steps.length - 1" class="step-connector" :class="{ 'is-completed': index < currentStepIndex || currentStep === 'complete' }"></div>
      </template>
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
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0;
}

.progress-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  position: relative;
  flex: 0 0 auto;
}

.step-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
}

.step-circle {
  width: 40px;
  height: 40px;
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
  background: var(--color-success, #22c55e);
  border-color: var(--color-success, #22c55e);
  color: white;
}

.progress-step.is-current .step-circle {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.step-connector {
  flex: 1;
  height: 2px;
  background: var(--color-border);
  align-self: center;
  margin-top: -20px;
  transition: background-color 0.3s ease;
}

.step-connector.is-completed {
  background: var(--color-success, #22c55e);
}

.step-content {
  text-align: center;
  max-width: 120px;
}

.step-label {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  transition: color 0.3s ease;
  line-height: 1.3;
}

.progress-step.is-current .step-label {
  color: var(--color-text-primary);
}

.progress-step.is-completed .step-label {
  color: var(--color-success, #22c55e);
}

.step-description {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin-top: var(--space-1);
  line-height: var(--line-height-relaxed);
  min-height: 2.4em; /* Reserve space for 2 lines of text */
  opacity: 0;
  transform: translateY(-4px);
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.step-description.is-visible {
  opacity: 1;
  transform: translateY(0);
}

.step-number {
  font-size: var(--font-size-sm);
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .step-circle {
    width: 32px;
    height: 32px;
  }

  .step-content {
    max-width: 80px;
  }

  .step-label {
    font-size: 10px;
  }

  .step-connector {
    margin-top: -16px;
  }
}
</style>
