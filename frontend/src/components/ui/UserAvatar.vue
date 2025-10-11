<template>
  <div class="user-avatar-wrapper">
    <button
      class="user-avatar"
      :class="[size]"
      @click="$emit('click')"
      :aria-label="ariaLabel"
      type="button"
    >
      <span v-if="initials" class="avatar-initials">{{ initials }}</span>
      <svg
        v-else
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        class="avatar-icon"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    </button>
    <span v-if="badge && badge > 0" class="avatar-badge">{{ badge }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  givenName?: string
  familyName?: string
  size?: 'sm' | 'md' | 'lg'
  badge?: number
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
})

defineEmits<{
  click: []
}>()

const initials = computed(() => {
  if (!props.givenName && !props.familyName) return ''

  const firstInitial = props.givenName?.charAt(0).toUpperCase() || ''
  const lastInitial = props.familyName?.charAt(0).toUpperCase() || ''

  return `${firstInitial}${lastInitial}`.trim()
})

const ariaLabel = computed(() => {
  if (props.givenName || props.familyName) {
    return `${props.givenName || ''} ${props.familyName || ''}`.trim()
  }
  return 'User account'
})
</script>

<style scoped>
.user-avatar-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.user-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: white;
  font-weight: var(--font-weight-semibold);
  border: 2px solid var(--color-border);
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.user-avatar:hover {
  transform: scale(1.05);
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-primary) 25%, transparent);
}

.user-avatar:active {
  transform: scale(0.98);
}

.user-avatar:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-primary) 25%, transparent);
}

/* Sizes */
.user-avatar.sm {
  width: 32px;
  height: 32px;
  font-size: var(--font-size-xs);
}

.user-avatar.md {
  width: 40px;
  height: 40px;
  font-size: var(--font-size-sm);
}

.user-avatar.lg {
  width: 48px;
  height: 48px;
  font-size: var(--font-size-base);
}

.avatar-initials {
  user-select: none;
}

.avatar-icon {
  width: 60%;
  height: 60%;
}

.avatar-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 var(--space-1);
  background: var(--color-error);
  color: white;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  border: 2px solid var(--color-bg-primary);
  pointer-events: none;
  z-index: 1;
}
</style>
