<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { authAPI } from '@/services/api'

const app = useAppStore()

const timer = ref<number | undefined>(undefined)
const etag = ref<string | undefined>(undefined)
let backoff = 0 // ms

async function poll() {
  if (!app.isAuthenticated) return
  if (document.hidden) return
  try {
    const res = await authAPI.getUnreadNotificationCountETag(etag.value)
    if (!res.notModified && typeof res.count === 'number') {
      app.unreadNotificationCount = res.count
      etag.value = res.etag
    }
    backoff = 0
  } catch {
    backoff = backoff ? Math.min(backoff * 2, 5 * 60_000) : 10_000
  } finally {
    schedule()
  }
}

function schedule() {
  clear()
  const delay = backoff || 30_000
  timer.value = window.setTimeout(poll, delay)
}

function clear() {
  if (timer.value) {
    clearTimeout(timer.value)
    timer.value = undefined
  }
}

function start() {
  // Safety: only start when authenticated
  if (!app.isAuthenticated) return
  // immediate fetch then schedule
  void poll()
  window.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('focus', onFocus, true)
}

function stop() {
  clear()
  window.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('focus', onFocus, true)
}

function onVisibility() {
  if (!document.hidden) void poll()
}
function onFocus() {
  void poll()
}

onMounted(() => {
  if (app.isAuthenticated) start()
})

onUnmounted(() => {
  stop()
})

watch(
  () => app.isAuthenticated,
  (authed) => {
    if (authed) {
      etag.value = undefined // reset etag on new session
      start()
    } else {
      stop()
      etag.value = undefined
      backoff = 0
      app.unreadNotificationCount = 0
    }
  },
  { immediate: false },
)
</script>

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
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
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
  grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr));
  gap: var(--space-4);
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
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
