<script setup lang="ts"></script>

<template>
  <router-view />
</template>

<style>
/* Form Styles */
.onboarding-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  margin-top: var(--space-4);
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.form-section h5,
.section-title {
  margin: 0 0 var(--space-3) 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--space-4);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.form-field.full-width {
  grid-column: 1 / -1;
}

.form-field label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

/* Keep styles for select element which is still used for Account Type */
.form-field select {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  transition: border-color 0.2s ease;
  width: 100%;
}

.form-field select:focus {
  outline: none;
  border-color: var(--color-primary);
}

.form-field select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.form-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

.form-note {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}
@media (max-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
