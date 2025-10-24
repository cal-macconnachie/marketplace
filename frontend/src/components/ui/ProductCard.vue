<template>
  <div
    v-if="imageFocused"
    class="product-card product-card--image-focused"
    @click="$emit('click', product)"
  >
    <!-- Full-width image background -->
    <ImageCarousel
      v-if="product.images && product.images.length > 0"
      :images="product.images"
      :alt="product.name"
      size="full"
      hide-arrows
      class="image-focused-carousel"
    />
    <div v-else class="product-image-placeholder product-image-placeholder--overlay">
      <svg width="48" height="48" viewBox="0 0 20 20" fill="currentColor">
        <path
          fill-rule="evenodd"
          d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
          clip-rule="evenodd"
        />
      </svg>
    </div>

    <!-- Overlaid badge -->
    <ProductBadge :price-data="product.default_price_data" compact class="overlay-badge" />

    <!-- Overlaid content at bottom -->
    <div class="overlay-content">
      <h3 class="product-title product-title--image-focused">
        {{ product.name }}
      </h3>
      <PriceDisplay
        :amount="product.default_price_data.unit_amount"
        :currency="product.default_price_data.currency"
        :recurring="!!product.default_price_data.recurring"
        :usage_type="product.default_price_data.recurring?.usage_type"
        :interval="product.default_price_data.recurring?.interval"
        :interval_count="product.default_price_data.recurring?.interval_count"
        :unit="product.default_price_data.unit_label"
        size="sm"
        class="overlay-price"
      />
    </div>

    <!-- Sold Out Overlay (Full Card) -->
    <div v-if="isSoldOut" class="sold-out-overlay sold-out-overlay--full-card">
      <div class="sold-out-text">SOLD OUT</div>
    </div>
  </div>
  <BaseCard
    v-else-if="compact"
    class="product-card product-card--compact"
    variant="outlined"
    padding="auto"
    @click="$emit('click', product)"
  >
    <!-- Sold Out Overlay (Full Card) -->
    <div v-if="isSoldOut" class="sold-out-overlay sold-out-overlay--full-card">
      <div class="sold-out-text sold-out-text--compact">SOLD OUT</div>
    </div>

    <div class="product-content product-content--compact">
      <!-- Product image (compact) -->
      <div v-if="product.images && product.images.length > 0" class="product-image-compact">
        <img :src="product.images[0]" :alt="product.name" class="product-image" />
      </div>

      <!-- Product info (compact) -->
      <div class="product-info-compact">
        <h3 class="product-title product-title--compact">
          {{ product.name }}
        </h3>
        <ProductBadge :price-data="product.default_price_data" compact />
        <PriceDisplay
          :amount="
            product.default_price_data.unit_amount *
            (props.quantity === undefined ? 1 : props.quantity)
          "
          :currency="product.default_price_data.currency"
          :recurring="!!product.default_price_data.recurring"
          :usage_type="product.default_price_data.recurring?.usage_type"
          :interval="product.default_price_data.recurring?.interval"
          :interval_count="product.default_price_data.recurring?.interval_count"
          :unit="product.default_price_data.unit_label"
          size="xs"
          class="product-price"
        />

        <!-- Action Slot (compact) -->
        <div class="product-actions product-actions--compact">
          <slot name="actions" :product="product">
            <!-- Default action hint when no slot provided -->
          </slot>
        </div>
      </div>
    </div>
  </BaseCard>
  <BaseCard
    v-else
    class="product-card"
    :class="{
      'product-card--subscription':
        product.default_price_data.recurring &&
        product.default_price_data.recurring.usage_type !== 'metered',
      'product-card--metered':
        product.default_price_data.recurring &&
        product.default_price_data.recurring.usage_type === 'metered',
      'product-card--one-time': !product.default_price_data.recurring,
    }"
    variant="outlined"
    @click="$emit('click', product)"
  >
    <!-- Sold Out Overlay (Full Card) -->
    <div v-if="isSoldOut" class="sold-out-overlay sold-out-overlay--full-card">
      <div class="sold-out-text">SOLD OUT</div>
    </div>

    <div class="product-content">
      <!-- Product Images -->
      <div v-if="product.images && product.images.length > 0" class="product-images">
        <ImageCarousel :images="product.images" :alt="product.name" size="sm" hide-arrows />
      </div>

      <!-- Product Details -->
      <div class="product-details">
        <div class="product-header">
          <h3 class="product-title">{{ product.name }}</h3>
        </div>
        <div class="product-type-badge">
          <!-- Error Badge -->
          <div v-if="product.error" class="error-badge" title="Product has an error">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
              <path
                fill-rule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clip-rule="evenodd"
              />
            </svg>
          </div>
          <ProductBadge :price-data="product.default_price_data" />
        </div>

        <!-- Flexible content area -->
        <div class="product-content-wrapper">
          <div class="product-description" v-if="product.description">
            {{ product.description }}
          </div>

          <div v-if="product.marketing_features?.length" class="product-features">
            <ul>
              <li v-for="feature in product.marketing_features" :key="feature.name">
                {{ feature.name }}
              </li>
            </ul>
          </div>
        </div>

        <PriceDisplay
          :amount="product.default_price_data.unit_amount"
          :currency="product.default_price_data.currency"
          :recurring="!!product.default_price_data.recurring"
          :usage_type="product.default_price_data.recurring?.usage_type"
          :interval="product.default_price_data.recurring?.interval"
          :interval_count="product.default_price_data.recurring?.interval_count"
          :unit="product.default_price_data.unit_label"
          size="md"
          class="product-price"
        />
        <!-- Action Slot -->
        <div class="product-actions">
          <slot name="actions" :product="product">
            <!-- Default action hint when no slot provided -->
          </slot>
        </div>
      </div>
    </div>
  </BaseCard>
</template>

<script setup lang="ts">
import type { Product } from '@marketplace/types'
import { computed } from 'vue'
import BaseCard from './BaseCard.vue'
import ImageCarousel from './ImageCarousel.vue'
import PriceDisplay from './PriceDisplay.vue'
import ProductBadge from './ProductBadge.vue'
interface Props {
  product: Product
  compact?: boolean
  imageFocused?: boolean
  quantity?: number
}

const props = defineProps<Props>()

defineEmits<{
  click: [product: Product]
}>()

const isSoldOut = computed(() => {
  return props.quantity !== undefined && props.quantity === 0
})
</script>

<style scoped>
.product-card {
  display: flex;
  flex-direction: column;
  min-width: 320px;
  max-width: 320px;
  min-height: 400px;
  flex-shrink: 0;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-lg);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  tap-highlight-color: transparent;
}

.product-card :deep(.base-card) {
  height: 100%;
}

.product-card :deep(.card-body) {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.product-card:hover {
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.12);
}

.product-card--subscription {
  background: linear-gradient(
    135deg,
    var(--color-subscription-bg-gradient-start) 0%,
    var(--color-subscription-bg-gradient-end) 100%
  );
}

.product-card--one-time {
  background: linear-gradient(
    135deg,
    var(--color-onetime-bg-gradient-start) 0%,
    var(--color-onetime-bg-gradient-end) 100%
  );
}

.product-card--metered {
  background: linear-gradient(
    135deg,
    var(--color-metered-bg-gradient-start) 0%,
    var(--color-metered-bg-gradient-end) 100%
  );
}

.product-card:active {
  transition: all 0.1s ease;
}

.product-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.product-type-badge {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.error-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.1);
  color: rgb(239, 68, 68);
  border: 1px solid rgba(239, 68, 68, 0.2);
  flex-shrink: 0;
}

.product-images {
  margin-bottom: var(--space-4);
  display: flex;
  justify-content: center;
}

.product-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.product-content-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-bottom: var(--space-4);
}

.product-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-3);
}

.product-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
  line-height: var(--line-height-tight);
  flex: 1;
}

.product-description {
  color: var(--color-text-secondary);
  line-height: var(--line-height-relaxed);
  margin: 0 0 var(--space-4) 0;
  font-size: var(--font-size-sm);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  min-height: 60px;
}

.product-features {
  min-height: 80px;
  overflow: hidden;
}

.product-features ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.product-features li {
  position: relative;
  padding-left: var(--space-5);
  margin-bottom: var(--space-1);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  line-height: var(--line-height-relaxed);
}

.product-features li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: var(--color-primary);
  font-weight: var(--font-weight-bold);
}

.product-actions {
  margin-top: auto;
  padding-top: var(--space-2);
}

.product-action-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  opacity: 0.7;
  transition: all 0.2s ease;
}

.product-card:hover .product-action-hint {
  opacity: 1;
}

.action-text {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.product-card--subscription .action-text {
  color: var(--color-subscription);
}

.product-card--one-time .action-text {
  color: var(--color-onetime);
}

.product-card--metered .action-text {
  color: var(--color-metered);
}

.action-arrow {
  transition: transform 0.2s ease;
  color: var(--color-text-secondary);
}

.product-card--subscription .action-arrow {
  color: var(--color-subscription);
}

.product-card--one-time .action-arrow {
  color: var(--color-onetime);
}

.product-card--metered .action-arrow {
  color: var(--color-metered);
}

/* Compact variant styles */
.product-card--compact {
  min-width: 280px;
  max-width: 320px;
  min-height: auto;
  cursor: pointer;
  transition: all 0.3s ease;
  margin: auto;
  -webkit-tap-highlight-color: transparent;
  tap-highlight-color: transparent;
}

.product-card--compact:hover {
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.12);
}

.product-content--compact {
  display: flex;
  flex-direction: row;
  gap: var(--space-3);
  align-items: center;
  padding: var(--space-2);
}

.product-image-compact {
  width: 60px;
  height: 60px;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: none;
  background: none;
  flex-shrink: 0;
}

.product-image-compact .product-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.product-info-compact {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: var(--space-1);
  min-height: 60px;
  min-width: 0;
}

.product-title--compact {
  width: 100%;
  display: flex;
  justify-content: end;
  padding-right: 30px;
}

.product-actions--compact {
  margin-top: auto;
  padding-top: 0;
  display: flex;
  justify-content: flex-start;
}

@media (max-width: 768px) {
  .product-card {
    min-width: 280px;
    max-width: 280px;
    min-height: 350px;
  }

  .product-card--compact {
    min-width: 260px;
    max-width: 280px;
    min-height: 50px;
  }

  .product-content--compact {
    gap: var(--space-2);
  }

  .product-image-compact {
    width: 60px;
    height: 60px;
  }

  .product-info-compact {
    min-height: 60px;
    gap: var(--space-1);
  }

  .product-description {
    -webkit-line-clamp: 2;
    line-clamp: 2;
    min-height: 40px;
  }

  .product-features {
    min-height: 60px;
  }

  .product-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }

  .product-price {
    width: 100%;
    display: flex;
    justify-content: end;
  }
}

/* Image-focused variant styles */
.product-card--image-focused {
  position: relative;
  width: 300px;
  height: 300px;
  min-width: 300px;
  max-width: 300px;
  min-height: 300px;
  max-height: 300px;
  flex-shrink: 0;
  border-radius: var(--radius-lg);
  overflow: hidden;
  cursor: pointer;
  border: 2px solid var(--color-border);
  background-color: var(--color-bg-primary);
  transition: all 0.3s ease;
  -webkit-tap-highlight-color: transparent;
  tap-highlight-color: transparent;
}

.product-card--image-focused:hover {
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.12);
}

.image-focused-carousel {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}

.image-focused-carousel :deep(.carousel__image) {
  object-fit: cover;
  border-radius: 0;
}

.product-image-placeholder {
  width: 100%;
  height: 100%;
  background: var(--color-bg-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
}

.product-image-placeholder--overlay {
  position: absolute;
  top: 0;
  left: 0;
}

.product-image-placeholder > svg {
  flex-shrink: 0;
}

.overlay-badge {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 2;
}

.overlay-content {
  position: absolute;
  bottom: 0px;
  left: 0px;
  right: 0px;
  padding: var(--space-3);
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(1px);
  border-radius: var(--radius-md);
  border: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
  transform: translateY(0);
}

.product-card--image-focused:hover .overlay-content {
  transform: translateY(100%);
  opacity: 0;
}

.product-title--image-focused {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  color: white;
  margin: 0;
  line-height: var(--line-height-tight);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

.overlay-price {
  color: white;
}

.overlay-price :deep(.price-amount),
.overlay-price :deep(.price-currency),
.overlay-price :deep(.price-interval),
.overlay-price :deep(.price-unit) {
  color: white;
}

@media (max-width: 768px) {
  .product-card--image-focused {
    width: 250px;
    height: 250px;
    min-width: 250px;
    max-width: 250px;
    min-height: 250px;
    max-height: 250px;
  }

  .overlay-content {
    bottom: 8px;
    left: 8px;
    right: 8px;
    padding: var(--space-2);
    gap: var(--space-1);
  }

  .product-title--image-focused {
    font-size: var(--font-size-xs);
  }
}

/* Sold Out Overlay Styles */
.sold-out-overlay--full-card {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-bg-inverse-muted);
  opacity: 0.8;
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  border-radius: var(--radius-lg);
  transition: opacity 0.3s ease;
}

.sold-out-overlay--full-card:hover {
  opacity: 0;
}

.sold-out-text {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.sold-out-text--compact {
  font-size: var(--font-size-xs);
  letter-spacing: 0.05em;
}

/* Ensure cards have relative positioning for absolute overlay */
.product-card {
  position: relative;
}

.product-card--compact {
  position: relative;
}

.product-card--image-focused {
  position: relative;
}
</style>
