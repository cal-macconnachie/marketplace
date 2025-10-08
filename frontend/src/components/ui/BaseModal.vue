<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="modal-overlay"
      :class="overlayClasses"
      @click="handleOverlayClick"
      @keyup.esc="handleEscape"
      tabindex="-1"
    >
      <div
        ref="modalContainerRef"
        class="modal-container"
        :class="modalClasses"
        :style="modalStyle"
        @click.stop
        role="dialog"
        :aria-labelledby="title ? 'modal-title' : undefined"
        aria-modal="true"
      >
        <!-- Drawer Handle -->
        <div
          v-if="variant === 'drawer'"
          class="drawer-handle"
          @click.stop="handleClose"
          role="button"
          tabindex="0"
          @keydown.enter="handleClose"
          @keydown.space.prevent="handleClose"
          aria-label="Close drawer"
        >
          <div class="drawer-handle-bar"></div>
        </div>

        <!-- Drawer Content Wrapper -->
        <div v-if="variant === 'drawer'" class="drawer-content" :class="`drawer-content--${size}`">
          <!-- Header -->
          <header v-if="$slots.header || title" class="modal-header">
            <slot name="header">
              <h3 v-if="title" id="modal-title" class="modal-title">{{ title }}</h3>
            </slot>
          </header>

          <!-- Body -->
          <div class="modal-body" :class="bodyClasses">
            <slot />
          </div>

          <!-- Footer -->
          <footer v-if="$slots.footer" class="modal-footer">
            <slot name="footer" />
          </footer>
        </div>

        <!-- Modal Content (non-drawer) -->
        <template v-else>
          <!-- Close Button -->
          <button
            v-if="showCloseButton"
            class="modal-close-btn"
            @click="handleClose"
            :disabled="disableClose"
            aria-label="Close modal"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>

          <!-- Header -->
          <header v-if="$slots.header || title" class="modal-header">
            <slot name="header">
              <h3 v-if="title" id="modal-title" class="modal-title">{{ title }}</h3>
            </slot>
          </header>

          <!-- Body -->
          <div class="modal-body" :class="bodyClasses">
            <slot />
          </div>

          <!-- Footer -->
          <footer v-if="$slots.footer" class="modal-footer">
            <slot name="footer" />
          </footer>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

interface Props {
  show: boolean
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  closeOnOverlayClick?: boolean
  closeOnEscape?: boolean
  showCloseButton?: boolean
  disableClose?: boolean
  position?: 'center' | 'top' | 'bottom'
  noPadding?: boolean
  noBodyPadding?: boolean
  hideScrollbar?: boolean
  variant?: 'modal' | 'drawer'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  closeOnOverlayClick: true,
  closeOnEscape: true,
  showCloseButton: true,
  disableClose: false,
  position: 'center',
  noPadding: false,
  noBodyPadding: false,
  hideScrollbar: true,
  variant: 'drawer',
})

const emit = defineEmits<{
  close: []
  'update:show': [value: boolean]
}>()

const isClosing = ref(false)
const modalContainerRef = ref<HTMLElement | null>(null)

const overlayClasses = computed(() => [
  `modal-overlay--${props.variant === 'drawer' ? 'bottom' : props.position}`,
  {
    'modal-overlay--no-blur': props.position === 'bottom' || props.variant === 'drawer',
    'modal-overlay--closing': isClosing.value,
  },
])

const modalClasses = computed(() => [
  props.variant !== 'drawer' ? `modal-container--${props.size}` : null,
  `modal-container--${props.variant === 'drawer' ? 'drawer' : props.position}`,
  {
    'modal-container--no-padding': props.noPadding,
    'modal-container--hide-scrollbar': props.hideScrollbar,
    'modal-container--closing': isClosing.value,
  },
])

const bodyClasses = computed(() => ({
  'modal-body--no-padding': props.noBodyPadding,
}))

const modalStyle = computed(() => {
  if (props.size === 'full') {
    return {
      width: '100vw',
      height: '100vh',
      maxWidth: '100vw',
      maxHeight: '100vh',
      margin: 0,
      borderRadius: 0,
    }
  }
  return {}
})

const handleOverlayClick = () => {
  if (props.closeOnOverlayClick && !props.disableClose) {
    handleClose()
  }
}

const handleEscape = () => {
  if (props.closeOnEscape && !props.disableClose) {
    handleClose()
  }
}

const handleClose = () => {
  if (props.variant === 'drawer') {
    isClosing.value = true
    setTimeout(() => {
      isClosing.value = false
      emit('close')
      emit('update:show', false)
    }, 300) // Match animation duration
  } else {
    emit('close')
    emit('update:show', false)
  }
}

// Lock body scroll when modal is open
watch(
  () => props.show,
  (isOpen) => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  },
  { immediate: true },
)

// Handle ESC key globally
const handleGlobalEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.show) {
    handleEscape()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleGlobalEscape)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalEscape)
  document.body.style.overflow = ''
})

// Expose close method so parent can trigger animated close
defineExpose({
  close: handleClose,
})
</script>

<style scoped>
/* Modal Overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  z-index: var(--z-modal, 1000);
  padding: var(--space-4);
  backdrop-filter: blur(4px);
  animation: fadeIn 0.2s ease-out;
}

.modal-overlay--center {
  align-items: center;
  justify-content: center;
}

.modal-overlay--top {
  align-items: flex-start;
  justify-content: center;
  padding-top: var(--space-8);
}

.modal-overlay--bottom {
  align-items: flex-end;
  justify-content: center;
  padding: 0;
}

.modal-overlay--no-blur {
  backdrop-filter: none;
}

/* Modal Container */
.modal-container {
  background: var(--color-bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-2xl);
  width: 100%;
  max-height: 85vh;
  min-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideInScale 0.3s ease-out;
  transform-origin: center center;
}

.modal-container--center {
  margin: auto;
}

.modal-container--bottom {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  max-height: 95vh;
}

.modal-container--drawer {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  border-top-left-radius: var(--radius-xl, 20px);
  border-top-right-radius: var(--radius-xl, 20px);
  max-height: 90vh;
  max-width: 100vw;
  width: 100vw;
  animation: slideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  transform-origin: bottom center;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-container--drawer.modal-container--closing {
  animation: slideDown 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.modal-overlay--closing {
  animation: fadeOut 0.3s ease-out;
}

/* Drawer Content Wrapper - constrains content to size prop */
.drawer-content {
  width: 100%;
  max-width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
}

.drawer-content--sm {
  max-width: 400px;
}

.drawer-content--md {
  max-width: 600px;
}

.drawer-content--lg {
  max-width: 900px;
}

.drawer-content--xl {
  max-width: 1200px;
}

.drawer-content--full {
  max-width: 100%;
}

/* Size Variants */
.modal-container--sm {
  max-width: 400px;
}

.modal-container--md {
  max-width: 600px;
}

.modal-container--lg {
  max-width: 900px;
}

.modal-container--xl {
  max-width: 1200px;
}

.modal-container--full {
  width: 100vw;
  height: 100vh;
  max-width: 100vw;
  max-height: 100vh;
  margin: 0;
  border-radius: 0;
}

.modal-container--no-padding {
  padding: 0;
}

.modal-container--hide-scrollbar {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.modal-container--hide-scrollbar::-webkit-scrollbar {
  display: none;
}

/* Drawer Handle */
.drawer-handle {
  display: flex;
  justify-content: center;
  padding-top: var(--space-3);
  padding-bottom: var(--space-2);
  flex-shrink: 0;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.drawer-handle:hover .drawer-handle-bar {
  opacity: 0.7;
}

.drawer-handle:active .drawer-handle-bar {
  opacity: 0.9;
}

.drawer-handle-bar {
  width: 36px;
  height: 5px;
  background: var(--color-text-muted, #d1d5db);
  border-radius: 100px;
  opacity: 0.5;
  transition: opacity 0.2s ease;
}

/* Close Button */
.modal-close-btn {
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2);
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
  z-index: 10;
}

.modal-close-btn:hover:not(:disabled) {
  background: var(--color-bg-muted);
  color: var(--color-text-primary);
}

.modal-close-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.modal-close-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Header */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-6);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.modal-title {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  line-height: var(--line-height-tight);
  padding-right: var(--space-8);
}

/* Body */
.modal-body {
  padding: var(--space-6);
  overflow-y: visible;
  flex-shrink: 0;
}

/* Drawer body allows scrolling when content exceeds 90vh */
.modal-container--drawer .modal-body {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.modal-body--no-padding {
  padding: 0;
}

/* Footer */
.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-6);
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}

/* Animations */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideInScale {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideDown {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(100%);
  }
}

@keyframes fadeOut {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

/* Responsive Design */
@media (max-width: 640px) {
  .modal-overlay {
    padding: 0;
    align-items: flex-end;
  }

  .modal-overlay--top {
    padding-top: 0;
  }

  .modal-container {
    max-width: 100%;
    max-height: 95vh;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }

  .modal-container--center {
    margin: 0;
  }

  .modal-header,
  .modal-body,
  .modal-footer {
    padding: var(--space-4);
  }

  .modal-body {
    padding-top: var(--space-6);
  }
  .modal-container--drawer {
    max-height: 80vh;
  }
}

@media (prefers-reduced-motion: reduce) {
  .modal-overlay,
  .modal-container {
    animation: none;
  }
}
</style>
