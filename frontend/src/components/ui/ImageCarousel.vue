<template>
  <section
    class="carousel"
    :class="{
      'carousel--compact': compact,
      'carousel--sm': size === 'sm',
      'carousel--md': size === 'md',
      'carousel--lg': size === 'lg',
      'carousel--full': size === 'full',
    }"
    aria-label="Image Gallery"
  >
    <div class="carousel__viewport">
      <div
        v-for="(image, index) in images"
        :key="index"
        :id="`carousel__slide${carouselId}_${index + 1}`"
        tabindex="0"
        class="carousel__slide"
      >
        <div class="carousel__snapper">
          <img :src="image" :alt="alt || `Image ${index + 1}`" class="carousel__image" />
        </div>
      </div>
    </div>
    <!-- Fixed Navigation Arrows -->
    <button
      v-if="images.length > 1 && !hideArrows"
      @click="previousSlide"
      class="carousel__prev"
      aria-label="Go to previous slide"
    ></button>
    <button
      v-if="images.length > 1 && !hideArrows"
      @click="nextSlide"
      class="carousel__next"
      aria-label="Go to next slide"
    ></button>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  images: string[]
  alt?: string
  compact?: boolean
  size?: 'sm' | 'md' | 'lg' | 'full'
  hideArrows?: boolean
}

const props = defineProps<Props>()

// Generate unique ID for this carousel instance
const carouselId = ref(Math.random().toString(36).substring(7))
const currentSlide = ref(0)

const nextSlide = () => {
  if (props.images.length > 1) {
    currentSlide.value = (currentSlide.value + 1) % props.images.length
    const slideElement = document.getElementById(
      `carousel__slide${carouselId.value}_${currentSlide.value + 1}`,
    )
    slideElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
  }
}

const previousSlide = () => {
  if (props.images.length > 1) {
    currentSlide.value =
      currentSlide.value === 0 ? props.images.length - 1 : currentSlide.value - 1
    const slideElement = document.getElementById(
      `carousel__slide${carouselId.value}_${currentSlide.value + 1}`,
    )
    slideElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
  }
}
</script>

<style scoped>
/* CSS-only Carousel Styles */
.carousel {
  position: relative;
  width: 300px;
  height: 300px;
  filter: drop-shadow(0 4px 16px rgba(0, 0, 0, 0.1));
  perspective: 100px;
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.carousel--compact {
  width: 200px;
  height: 200px;
}

.carousel__viewport {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  overflow-x: scroll;
  overflow-y: hidden;
  scroll-behavior: smooth;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.carousel__viewport::-webkit-scrollbar {
  display: none;
}

.carousel__slide {
  position: relative;
  flex: 0 0 100%;
  width: 100%;
}

.carousel__slide:not(:last-child) {
  margin-right: 2px;
}

.carousel__snapper {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  scroll-snap-align: center;
}

.carousel__image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: var(--radius-lg);
  pointer-events: none;
  user-select: none;
}

@media (prefers-reduced-motion: reduce) {
  .carousel__snapper {
    animation-name: none;
  }
}

.carousel__prev,
.carousel__next {
  position: absolute;
  top: 50%;
  width: 40px;
  height: 40px;
  transform: translateY(-50%);
  border-radius: var(--radius-full);
  border: none;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: rgba(255, 255, 255, 0.8);
}

.carousel:hover .carousel__prev,
.carousel:hover .carousel__next {
  opacity: 1;
}

.carousel__prev {
  left: 12px;
}

.carousel__next {
  right: 12px;
}

.carousel__prev::before {
  content: '‹';
  font-weight: bold;
  line-height: 1;
  margin-top: -2px;
  color: var(--color-text-primary);
  text-shadow: 0 0 3px var(--color-text-inverse);
}

.carousel__next::before {
  content: '›';
  font-weight: bold;
  line-height: 1;
  margin-top: -2px;
  color: var(--color-text-primary);
  text-shadow: 0 0 3px var(--color-text-inverse);
}

.carousel__prev:hover,
.carousel__next:hover {
  background: var(--color-bg-primary);
  backdrop-filter: blur(8px);
  transform: translateY(-50%) scale(1.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  color: var(--color-text-primary);
}

.carousel__prev:active,
.carousel__next:active {
  transform: translateY(-50%) scale(0.95);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* Size variants */
.carousel--sm {
  width: 120px;
  height: 120px;
}

.carousel--md {
  width: 200px;
  height: 200px;
}

.carousel--lg {
  width: 300px;
  height: 300px;
}

.carousel--full {
  width: 100%;
  height: 100%;
  border-radius: 0;
  filter: none;
  box-sizing: border-box;
}

/* Compact variant adjustments */
.carousel--compact .carousel__prev,
.carousel--compact .carousel__next {
  width: 32px;
  height: 32px;
  font-size: 16px;
}

.carousel--compact .carousel__prev {
  left: 8px;
}

.carousel--compact .carousel__next {
  right: 8px;
}

.carousel--sm .carousel__prev,
.carousel--sm .carousel__next {
  width: 24px;
  height: 24px;
  font-size: 14px;
}

.carousel--sm .carousel__prev {
  left: 4px;
}

.carousel--sm .carousel__next {
  right: 4px;
}
</style>
