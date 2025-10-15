<template>
  <div
    class="base-skeleton"
    :class="[variantClass, roundedClass]"
    :style="skeletonStyles"
    :aria-busy="true"
    :aria-label="ariaLabel"
  >
    <div v-if="variant === 'card'" class="skeleton-card">
      <div class="skeleton-header">
        <div class="skeleton-title"></div>
      </div>
      <div class="skeleton-body">
        <div v-for="i in lines" :key="i" class="skeleton-line" :style="{ width: getLineWidth(i) }"></div>
      </div>
    </div>
    <div v-else-if="variant === 'avatar'" class="skeleton-avatar"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'text' | 'card' | 'avatar' | 'rectangle'
  width?: string | number
  height?: string | number
  lines?: number
  rounded?: boolean | 'full'
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'rectangle',
  width: '100%',
  height: '20px',
  lines: 3,
  rounded: false,
  ariaLabel: 'Loading content',
})

const variantClass = computed(() => `skeleton--${props.variant}`)

const roundedClass = computed(() => {
  if (props.rounded === 'full') return 'skeleton--rounded-full'
  if (props.rounded) return 'skeleton--rounded'
  return ''
})

const skeletonStyles = computed(() => {
  const styles: Record<string, string> = {}

  if (props.width) {
    styles.width = typeof props.width === 'number' ? `${props.width}px` : props.width
  }

  if (props.height && props.variant !== 'card') {
    styles.height = typeof props.height === 'number' ? `${props.height}px` : props.height
  }

  if (props.variant === 'card' && props.height) {
    styles.minHeight = typeof props.height === 'number' ? `${props.height}px` : props.height
  }

  return styles
})

const getLineWidth = (lineNumber: number) => {
  // Last line is shorter to look more natural
  if (lineNumber === props.lines) {
    return '70%'
  }
  return '100%'
}
</script>

<style scoped>
.base-skeleton {
  background: linear-gradient(
    90deg,
    var(--color-bg-muted) 0%,
    var(--color-bg-secondary) 50%,
    var(--color-bg-muted) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  position: relative;
  overflow: hidden;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.skeleton--text {
  height: 1em;
  border-radius: var(--radius-sm);
}

.skeleton--rectangle {
  border-radius: var(--radius-md);
}

.skeleton--rounded {
  border-radius: var(--radius-lg);
}

.skeleton--rounded-full {
  border-radius: var(--radius-full);
}

.skeleton--avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
}

.skeleton--card {
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-bg-primary);
  padding: var(--space-6);
  min-height: 200px;
}

.skeleton-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  height: 100%;
}

.skeleton-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.skeleton-title {
  height: 24px;
  width: 40%;
  background: linear-gradient(
    90deg,
    var(--color-bg-muted) 0%,
    var(--color-bg-secondary) 50%,
    var(--color-bg-muted) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: var(--radius-sm);
}

.skeleton-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  flex: 1;
}

.skeleton-line {
  height: 16px;
  background: linear-gradient(
    90deg,
    var(--color-bg-muted) 0%,
    var(--color-bg-secondary) 50%,
    var(--color-bg-muted) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: var(--radius-sm);
}

/* Respect prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  .base-skeleton,
  .skeleton-title,
  .skeleton-line {
    animation: none;
    background: var(--color-bg-muted);
  }
}
</style>
