<template>
  <BaseButton
    variant="ghost"
    size="sm"
    @click="themeStore.toggleTheme()"
    :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
    class="theme-toggle"
  >
    <svg
      v-if="isDark"
      viewBox="0 0 20 20"
      fill="currentColor"
      class="theme-icon"
      aria-hidden="true"
    >
      <path
        fill-rule="evenodd"
        d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
        clip-rule="evenodd"
      />
    </svg>

    <svg v-else viewBox="0 0 20 20" fill="currentColor" class="theme-icon" aria-hidden="true">
      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
    </svg>

    <span class="sr-only">
      {{ isDark ? 'Switch to light mode' : 'Switch to dark mode' }}
    </span>
  </BaseButton>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useThemeStore } from '@/stores/theme'
import BaseButton from '@/components/ui/BaseButton.vue'

const themeStore = useThemeStore()
const { isDark } = storeToRefs(themeStore)
</script>

<style scoped>
.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.theme-toggle:hover {
  transform: scale(1.05);
}

.theme-icon {
  width: 1.25rem;
  height: 1.25rem;
  transition: transform var(--transition-fast);
}

.theme-toggle:active .theme-icon {
  transform: scale(0.95);
}

/* Animation for theme switching */
@media (prefers-reduced-motion: no-preference) {
  .theme-icon {
    animation: themeSwitch 0.3s ease-in-out;
  }
}

@keyframes themeSwitch {
  0% {
    transform: rotate(0deg) scale(1);
  }
  50% {
    transform: rotate(180deg) scale(0.8);
  }
  100% {
    transform: rotate(360deg) scale(1);
  }
}
</style>
