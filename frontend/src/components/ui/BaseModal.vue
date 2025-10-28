<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="modal-overlay"
      :class="overlayClasses"
      :style="overlayStyle"
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
          @click.stop="handleHandleClick"
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
  success: []
  error: [error: string]
}>()

const isClosing = ref(false)
const modalContainerRef = ref<HTMLElement | null>(null)

// Drag state
const isDragging = ref(false)
const isAnimating = ref(false)
const dragStartY = ref(0)
const dragCurrentY = ref(0)
const dragStartTime = ref(0)
const lastDragEndTime = ref(0)

const overlayClasses = computed(() => [
  `modal-overlay--${props.variant === 'drawer' ? 'bottom' : props.position}`,
  {
    'modal-overlay--no-blur': props.position === 'bottom' || props.variant === 'drawer',
    'modal-overlay--closing': isClosing.value,
  },
])

const overlayStyle = computed(() => {
  const style: Record<string, string | number> = {}

  return style
})

const modalClasses = computed(() => [
  props.variant !== 'drawer' ? `modal-container--${props.size}` : null,
  `modal-container--${props.variant === 'drawer' ? 'drawer' : props.position}`,
  {
    'modal-container--no-padding': props.noPadding,
    'modal-container--hide-scrollbar': props.hideScrollbar,
    'modal-container--closing': isClosing.value,
    'modal-container--dragging': isDragging.value,
  },
])

const bodyClasses = computed(() => ({
  'modal-body--no-padding': props.noBodyPadding,
}))

const modalStyle = computed(() => {
  const style: Record<string, string | number> = {}

  if (props.size === 'full') {
    style.width = '100vw'
    style.height = '100dvh'
    style.maxWidth = '100vw'
    style.maxHeight = '100dvh'
    style.margin = '0'
    style.borderRadius = '0'
  }

  return style
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

// Handle click on drawer handle - prevent close if drag just ended
const handleHandleClick = (event: MouseEvent) => {
  // Check if a drag just ended (within 200ms)
  const timeSinceLastDrag = Date.now() - lastDragEndTime.value
  if (timeSinceLastDrag < 200) {
    event.preventDefault()
    event.stopPropagation()
    return
  }

  handleClose()
}

const handleClose = () => {
  if (props.variant === 'drawer') {
    // Clean up any inline styles from dragging before starting CSS animation
    if (modalContainerRef.value) {
      modalContainerRef.value.style.transition = ''
      modalContainerRef.value.style.transform = ''
    }

    // Reset drag state
    isDragging.value = false
    isAnimating.value = false
    dragStartY.value = 0
    dragCurrentY.value = 0
    dragStartTime.value = 0

    isClosing.value = true

    // Read the transition duration from CSS variable
    const transitionDuration = getComputedStyle(document.documentElement)
      .getPropertyValue('--transition-slow')
      .trim()

    // Parse the duration (e.g., "500ms" -> 500)
    const durationMs = parseInt(transitionDuration)

    setTimeout(() => {
      emit('close')
      emit('update:show', false)
      // Reset isClosing after a small delay to let the component unmount with animation classes still applied
      setTimeout(() => {
        isClosing.value = false
      }, 50)
    }, durationMs)
  } else {
    emit('close')
    emit('update:show', false)
  }
}

// Drag handlers for drawer
const handleDragStart = (event: TouchEvent | MouseEvent) => {
  if (props.variant !== 'drawer' || props.disableClose || !modalContainerRef.value) return

  // Check if the drawer body is scrolled - only allow drag if at the top
  const modalBody = modalContainerRef.value.querySelector('.modal-body')
  if (modalBody && modalBody.scrollTop > 0) {
    return // Don't start drag if content is scrolled
  }

  // Check if drag started from the handle or from the top of content
  const target = event.target as HTMLElement
  const isHandle =
    target.classList.contains('drawer-handle') ||
    target.classList.contains('drawer-handle-bar') ||
    target.closest('.drawer-handle')

  // Allow drag from handle always, or from content when at top
  if (!isHandle && modalBody && modalBody.scrollTop > 0) {
    return
  }

  // Clean up any lingering inline styles before starting new drag
  modalContainerRef.value.style.transition = ''
  modalContainerRef.value.style.transform = ''

  isDragging.value = true
  dragStartTime.value = Date.now()

  if (event instanceof TouchEvent) {
    dragStartY.value = event.touches[0].clientY
    dragCurrentY.value = event.touches[0].clientY
  } else {
    dragStartY.value = event.clientY
    dragCurrentY.value = event.clientY
  }
}

const handleDragMove = (event: TouchEvent | MouseEvent) => {
  if (!isDragging.value || props.variant !== 'drawer' || !modalContainerRef.value) return

  if (event instanceof TouchEvent) {
    dragCurrentY.value = event.touches[0].clientY
  } else {
    dragCurrentY.value = event.clientY
  }

  const dragDistance = dragCurrentY.value - dragStartY.value

  // Prevent scrolling while dragging down and apply transform
  if (dragDistance > 0) {
    event.preventDefault()
    modalContainerRef.value.style.transform = `translateY(${dragDistance}px)`
    modalContainerRef.value.style.transition = 'none'
  }
}

const handleDragEnd = () => {
  if (!isDragging.value || props.variant !== 'drawer' || !modalContainerRef.value) return

  const dragDistance = Math.max(0, dragCurrentY.value - dragStartY.value)

  // Only record drag end time if there was actual drag movement (> 5px)
  // This prevents simple taps from blocking the click handler
  if (dragDistance > 5) {
    lastDragEndTime.value = Date.now()
  }

  const dragDuration = Date.now() - dragStartTime.value
  const velocity = dragDistance / dragDuration // pixels per millisecond

  // Determine if drawer should close based on distance or velocity
  const containerHeight = modalContainerRef.value.offsetHeight
  const distanceThreshold = Math.max(150, containerHeight * 0.3)
  const velocityThreshold = 0.5

  const shouldClose = dragDistance > distanceThreshold || velocity > velocityThreshold

  // Stop dragging and start animating
  isDragging.value = false
  isAnimating.value = true

  const container = modalContainerRef.value
  const targetPosition = shouldClose ? containerHeight + containerHeight * 0.1 : 0

  // Get transition duration from CSS tokens
  const transitionDuration = getComputedStyle(document.documentElement)
    .getPropertyValue('--transition-slow')
    .trim()
  const durationMs = parseInt(transitionDuration) || 300

  // Set starting position (current drag distance) with no transition
  container.style.transition = 'none'
  container.style.transform = `translateY(${dragDistance}px)`

  // Force reflow to apply the starting position
  void container.offsetHeight

  // Animate to target position using CSS variable for timing
  container.style.transition = `transform ${durationMs}ms cubic-bezier(0.4, 0, 0.2, 1)`
  container.style.transform = `translateY(${targetPosition}px)`

  // Clean up after animation completes
  setTimeout(() => {
    isAnimating.value = false
    dragStartY.value = 0
    dragCurrentY.value = 0
    dragStartTime.value = 0

    if (modalContainerRef.value) {
      modalContainerRef.value.style.transition = ''
      modalContainerRef.value.style.transform = ''
    }

    if (shouldClose) {
      emit('close')
      emit('update:show', false)
    }
  }, durationMs)
}

// Store scroll position
const scrollPosition = ref(0)

// Lock body scroll when modal is open and clean up inline styles
watch(
  () => props.show,
  (isOpen) => {
    if (isOpen) {
      // Save current scroll position
      scrollPosition.value = window.scrollY

      // Add a class to body to lock scroll
      document.body.classList.add('modal-open')

      // Set the top position to maintain visual position
      document.body.style.top = `-${scrollPosition.value}px`

      // Clean up any lingering inline styles from previous interactions
      // Use setTimeout to ensure ref is populated
      if (props.variant === 'drawer') {
        setTimeout(() => {
          if (modalContainerRef.value) {
            modalContainerRef.value.style.transition = ''
            modalContainerRef.value.style.transform = ''
          }
        }, 0)
      }
    } else {
      // Remove the class to restore scroll
      document.body.classList.remove('modal-open')

      // Clear the top position
      document.body.style.top = ''

      // Restore scroll position
      window.scrollTo(0, scrollPosition.value)

      // Clean up drag state and inline styles
      isDragging.value = false
      isAnimating.value = false
      lastDragEndTime.value = 0
      dragStartY.value = 0
      dragCurrentY.value = 0
      dragStartTime.value = 0

      if (modalContainerRef.value && props.variant === 'drawer') {
        modalContainerRef.value.style.transition = ''
        modalContainerRef.value.style.transform = ''
      }
    }
  },
)

// Handle ESC key globally
const handleGlobalEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.show) {
    handleEscape()
  }
}

// Add/remove drag listeners when modal opens/closes
watch(
  () => props.show,
  (isOpen) => {
    if (isOpen && props.variant === 'drawer') {
      // Wait for next tick to ensure modalContainerRef is populated
      setTimeout(() => {
        if (modalContainerRef.value) {
          const container = modalContainerRef.value

          // Touch events
          container.addEventListener('touchstart', handleDragStart as EventListener, {
            passive: false,
          })
          container.addEventListener('touchmove', handleDragMove as EventListener, { passive: false })
          container.addEventListener('touchend', handleDragEnd)

          // Mouse events for desktop testing
          container.addEventListener('mousedown', handleDragStart as EventListener)
          document.addEventListener('mousemove', handleDragMove as EventListener)
          document.addEventListener('mouseup', handleDragEnd)
        }
      }, 0)
    } else if (!isOpen && modalContainerRef.value) {
      // Remove listeners when closing
      const container = modalContainerRef.value
      container.removeEventListener('touchstart', handleDragStart as EventListener)
      container.removeEventListener('touchmove', handleDragMove as EventListener)
      container.removeEventListener('touchend', handleDragEnd)
      container.removeEventListener('mousedown', handleDragStart as EventListener)
      document.removeEventListener('mousemove', handleDragMove as EventListener)
      document.removeEventListener('mouseup', handleDragEnd)
    }
  },
)

onMounted(() => {
  document.addEventListener('keydown', handleGlobalEscape)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalEscape)

  // Remove drag event listeners
  if (modalContainerRef.value) {
    const container = modalContainerRef.value
    container.removeEventListener('touchstart', handleDragStart as EventListener)
    container.removeEventListener('touchmove', handleDragMove as EventListener)
    container.removeEventListener('touchend', handleDragEnd)
    container.removeEventListener('mousedown', handleDragStart as EventListener)
  }
  document.removeEventListener('mousemove', handleDragMove as EventListener)
  document.removeEventListener('mouseup', handleDragEnd)

  // Clean up scroll lock and drag state
  document.body.classList.remove('modal-open')
  document.body.style.top = ''
  isDragging.value = false
  isAnimating.value = false
  lastDragEndTime.value = 0

  // Restore scroll position if modal was open when unmounted
  if (scrollPosition.value > 0) {
    window.scrollTo(0, scrollPosition.value)
  }
})

// Expose close method so parent can trigger animated close
defineExpose({
  close: handleClose,
})
</script>

<style>
/* Global styles for body when modal is open - NOT scoped */
body.modal-open {
  overflow: hidden !important;
  position: fixed !important;
  width: 100% !important;
  height: 100% !important;
}
</style>

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

.modal-overlay--closing {
  animation: fadeOut var(--transition-slow) ease-out forwards;
}

/* Modal Container */
.modal-container {
  background: var(--color-bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-2xl);
  width: 100%;
  max-height: 85dvh;
  min-height: 85dvh;
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
  max-height: 95dvh;
}

.modal-container--drawer {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  border-top-left-radius: var(--radius-xl, 20px);
  border-top-right-radius: var(--radius-xl, 20px);
  max-height: 90dvh;
  max-width: 100vw;
  width: 100vw;
  animation: slideUp var(--transition-slow);
  transform-origin: bottom center;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: height var(--transition-slow) cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-container--drawer.modal-container--closing {
  animation: slideDown var(--transition-slow);
}

.modal-container--drawer.modal-container--dragging {
  user-select: none;
  -webkit-user-select: none;
  cursor: grabbing;
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
  height: 100dvh;
  max-width: 100vw;
  max-height: 100dvh;
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
  transition: opacity var(--transition-slow) ease;
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
  transition: all var(--transition-slow);
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

/* Drawer body allows scrolling when content exceeds 90dvh */
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
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

@keyframes slideDown {
  from {
    transform: translateY(0);
  }
  to {
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
    max-height: 95dvh;
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
    max-height: 80dvh;
  }
}

@media (prefers-reduced-motion: reduce) {
  .modal-overlay,
  .modal-container {
    animation: none;
  }
}
</style>
