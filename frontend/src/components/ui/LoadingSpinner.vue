<template>
  <div
    class="loading-spinner"
    :style="{ '--spinner-size': typeof size === 'number' ? `${size}px` : size }"
  >
    <img src="/direct-market.svg" class="spinner" :width="size" :height="size" alt="Loading..." />
  </div>
</template>

<script setup lang="ts">
interface Props {
  size?: number | string
}

withDefaults(defineProps<Props>(), {
  size: 16,
})
</script>

<style scoped>
.loading-spinner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.spinner {
  color: var(--color-primary);
  animation: spin 1s linear infinite;
  position: relative;
  z-index: 1;
  opacity: 1;
  transition: all 0.3s ease;
}

/* Dark mode - use text color */
[data-theme='dark'] .spinner {
  filter: brightness(0) saturate(100%) invert(98%) sepia(4%) saturate(346%) hue-rotate(183deg) brightness(106%) contrast(93%);
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
