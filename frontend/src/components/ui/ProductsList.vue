<template>
  <div class="products-list" :class="`products-list--${variant}`">
    <!-- Carousel Variant -->
    <div v-if="variant === 'carousel'" class="carousel-container">
      <div class="carousel-track" ref="carouselTrack" @scroll="handleScroll">
        <ProductCard
          v-for="product in products"
          :key="product.id"
          :product="product"
          class="carousel-item"
          @click="handlePurchaseClick(product)"
        >
          <template #actions="{ product }">
            <div v-if="shareable" class="product-share-actions">
              <BaseButton
                variant="outline"
                size="sm"
                @click.stop="shareProduct(product)"
                class="share-btn"
                :class="{
                  copied:
                    copyFeedback?.productId === product.id && copyFeedback?.action === 'share',
                }"
              >
                <svg
                  v-if="copyFeedback?.productId !== product.id || copyFeedback?.action !== 'share'"
                  width="14"
                  height="14"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"
                  />
                </svg>
                <svg v-else width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clip-rule="evenodd"
                  />
                </svg>
                Share
              </BaseButton>
              <BaseButton
                variant="outline"
                size="sm"
                @click.stop="embedProduct(product)"
                class="embed-btn"
                :class="{
                  copied:
                    copyFeedback?.productId === product.id && copyFeedback?.action === 'embed',
                }"
              >
                <svg
                  v-if="copyFeedback?.productId !== product.id || copyFeedback?.action !== 'embed'"
                  width="14"
                  height="14"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fill-rule="evenodd"
                    d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z"
                    clip-rule="evenodd"
                  />
                </svg>
                <svg v-else width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clip-rule="evenodd"
                  />
                </svg>
                Embed
              </BaseButton>
            </div>
            <div v-else-if="purchasable" class="product-action-hint">
              <span class="action-text">
                {{
                  product.default_price_data.recurring &&
                  product.default_price_data.recurring.usage_type === 'metered'
                    ? 'Click for Metered Usage'
                    : product.default_price_data.recurring
                      ? 'Click to Subscribe'
                      : 'Click to Purchase'
                }}
              </span>
              <svg
                class="action-arrow"
                width="16"
                height="16"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clip-rule="evenodd"
                />
              </svg>
            </div>
          </template>
        </ProductCard>
      </div>

      <!-- Carousel Navigation Buttons -->
      <button
        v-if="canScrollPrev"
        class="carousel-nav carousel-nav--prev"
        @click="scrollPrev"
        :disabled="!canScrollPrev"
        aria-label="Previous products"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path
            fill-rule="evenodd"
            d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
            clip-rule="evenodd"
          />
        </svg>
      </button>

      <button
        v-if="canScrollNext"
        class="carousel-nav carousel-nav--next"
        @click="scrollNext"
        :disabled="!canScrollNext"
        aria-label="Next products"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path
            fill-rule="evenodd"
            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
            clip-rule="evenodd"
          />
        </svg>
      </button>
    </div>

    <!-- Grid Variant -->
    <div v-else-if="variant === 'grid'" class="grid-container">
      <ProductCard
        v-for="product in products"
        :key="product.id"
        :product="product"
        :editable="editable"
        :shareable="shareable"
        :compact="viewMode === 'compact'"
        :image-focused="viewMode === 'image'"
        class="grid-item"
        @click="handlePurchaseClick(product)"
      >
        <template #actions="{ product }">
          <div v-if="shareable" class="product-share-actions">
            <BaseButton
              variant="outline"
              size="sm"
              @click.stop="shareProduct(product)"
              class="share-btn"
              :class="{
                copied: copyFeedback?.productId === product.id && copyFeedback?.action === 'share',
              }"
            >
              <svg
                v-if="copyFeedback?.productId !== product.id || copyFeedback?.action !== 'share'"
                width="14"
                height="14"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"
                />
              </svg>
              <svg v-else width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fill-rule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clip-rule="evenodd"
                />
              </svg>
              Share
            </BaseButton>
            <BaseButton
              variant="outline"
              size="sm"
              @click.stop="embedProduct(product)"
              class="embed-btn"
              :class="{
                copied: copyFeedback?.productId === product.id && copyFeedback?.action === 'embed',
              }"
            >
              <svg
                v-if="copyFeedback?.productId !== product.id || copyFeedback?.action !== 'embed'"
                width="14"
                height="14"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z"
                  clip-rule="evenodd"
                />
              </svg>
              <svg v-else width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fill-rule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clip-rule="evenodd"
                />
              </svg>
              Embed
            </BaseButton>
          </div>
        </template>
      </ProductCard>
    </div>

    <!-- List Variant -->
    <div v-else-if="variant === 'list'" class="list-container">
      <ProductCard
        v-for="product in products"
        :key="product.id"
        :product="product"
        :editable="editable"
        :shareable="shareable"
        class="list-item"
        @click="handlePurchaseClick(product)"
      >
        <template #actions="{ product }">
          <div v-if="shareable" class="product-share-actions">
            <BaseButton
              variant="outline"
              size="sm"
              @click.stop="shareProduct(product)"
              class="share-btn"
              :class="{
                copied: copyFeedback?.productId === product.id && copyFeedback?.action === 'share',
              }"
            >
              <svg
                v-if="copyFeedback?.productId !== product.id || copyFeedback?.action !== 'share'"
                width="14"
                height="14"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"
                />
              </svg>
              <svg v-else width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fill-rule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clip-rule="evenodd"
                />
              </svg>
              Share
            </BaseButton>
            <BaseButton
              variant="outline"
              size="sm"
              @click.stop="embedProduct(product)"
              class="embed-btn"
              :class="{
                copied: copyFeedback?.productId === product.id && copyFeedback?.action === 'embed',
              }"
            >
              <svg
                v-if="copyFeedback?.productId !== product.id || copyFeedback?.action !== 'embed'"
                width="14"
                height="14"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z"
                  clip-rule="evenodd"
                />
              </svg>
              <svg v-else width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fill-rule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clip-rule="evenodd"
                />
              </svg>
              Embed
            </BaseButton>
          </div>
        </template>
      </ProductCard>
    </div>
  </div>

  <!-- Confirmation Dialog -->
  <BaseModal
    ref="confirmDialogRef"
    v-model:show="showConfirmDialog"
    size="lg"
    @close="handleModalClose"
  >
    <template #default>
      <div class="modal-content-wrapper">
        <!-- Left Column: Product Info -->
        <div class="product-info-column">
          <!-- Product Header with Image and Badge -->
          <div class="product-header-section">
            <!-- Product Image -->
            <div
              v-if="selectedProduct?.images && selectedProduct.images.length > 0"
              class="product-image-preview"
            >
              <ImageCarousel
                :images="selectedProduct.images"
                :alt="selectedProduct.name"
                size="sm"
                hide-arrows
              />
            </div>
            <div v-else class="product-image-placeholder">
              <svg width="48" height="48" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fill-rule="evenodd"
                  d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                  clip-rule="evenodd"
                />
              </svg>
            </div>

            <!-- Product Info -->
            <div class="product-header-info">
              <h3 id="modal-title" class="product-name">{{ selectedProduct?.name }}</h3>
              <ProductBadge
                v-if="selectedProduct"
                :price-data="selectedProduct.default_price_data"
                class="product-badge-modal"
              />
            </div>
          </div>

          <!-- Product Description -->
          <div v-if="selectedProduct?.description" class="product-description-section">
            <p class="product-full-description">{{ selectedProduct.description }}</p>
          </div>

          <!-- Marketing Features -->
          <div v-if="selectedProduct?.marketing_features?.length" class="product-features-section">
            <h4 class="section-title">What's Included:</h4>
            <ul class="product-features-list">
              <li v-for="feature in selectedProduct.marketing_features" :key="feature.name">
                {{ feature.name }}
              </li>
            </ul>
          </div>

          <!-- Important Notices -->
          <BaseAlert
            v-if="
              selectedProduct?.default_price_data.recurring &&
              selectedProduct?.default_price_data.recurring.usage_type === 'metered'
            "
            variant="info"
            :show="true"
            class="billing-notice"
          >
            <template #default>
              <strong>Metered Billing:</strong> You'll be charged based on your actual usage at the
              base price per {{ selectedProduct.default_price_data.unit_label || 'unit' }}. Usage is
              tracked and billed automatically.
            </template>
          </BaseAlert>
          <BaseAlert
            v-else-if="selectedProduct?.default_price_data.recurring"
            variant="info"
            :show="true"
            class="billing-notice"
          >
            <template #default>
              <strong>Recurring Subscription:</strong> This will create a subscription that
              automatically renews every
              {{ selectedProduct.default_price_data.recurring.interval_count || 1 }}
              {{ selectedProduct.default_price_data.recurring.interval
              }}{{
                (selectedProduct.default_price_data.recurring.interval_count || 1) > 1 ? 's' : ''
              }}.
            </template>
          </BaseAlert>
        </div>

        <!-- Right Column: Pricing -->
        <div class="pricing-column">
          <!-- Price Summary -->
          <div class="price-summary-section">
            <h4 class="section-title">Price Summary</h4>
            <div class="price-breakdown">
              <div class="price-line">
                <span class="price-label">
                  {{
                    selectedProduct?.default_price_data.recurring &&
                    selectedProduct?.default_price_data.recurring.usage_type === 'metered'
                      ? 'Base Price (per unit)'
                      : selectedProduct?.default_price_data.recurring
                        ? 'Subscription Price'
                        : 'Unit Price'
                  }}:
                </span>
                <div class="price-value">
                  <PriceDisplay
                    v-if="selectedProduct"
                    :amount="selectedProduct.default_price_data.unit_amount"
                    :currency="selectedProduct.default_price_data.currency"
                    :recurring="!!selectedProduct.default_price_data.recurring"
                    :usage_type="
                      selectedProduct.default_price_data.recurring?.usage_type || 'licensed'
                    "
                    :interval="selectedProduct.default_price_data.recurring?.interval || 'month'"
                    :interval_count="
                      selectedProduct.default_price_data.recurring?.interval_count || 1
                    "
                    :unit="selectedProduct.default_price_data.unit_label"
                    size="sm"
                  />
                </div>
              </div>

              <div v-if="selectedProduct && !isMeteredProduct(selectedProduct)" class="price-line">
                <span class="price-label">Quantity:</span>
                <span class="price-value">{{ dialogQuantity }}</span>
              </div>

              <div class="price-line total-line">
                <span class="price-label">Total:</span>
                <div class="price-amount">
                  <PriceDisplay
                    v-if="selectedProduct"
                    :amount="
                      selectedProduct.default_price_data.unit_amount *
                      (isMeteredProduct(selectedProduct) ? 1 : dialogQuantity)
                    "
                    :currency="selectedProduct.default_price_data.currency"
                    :recurring="!!selectedProduct.default_price_data.recurring"
                    :usage_type="
                      selectedProduct.default_price_data.recurring?.usage_type || 'licensed'
                    "
                    :interval="selectedProduct.default_price_data.recurring?.interval || 'month'"
                    :interval_count="
                      selectedProduct.default_price_data.recurring?.interval_count || 1
                    "
                    :unit="selectedProduct.default_price_data.unit_label"
                    size="lg"
                  />
                </div>
              </div>
            </div>
          </div>
          <!-- Quantity Selector -->
          <div v-if="selectedProduct && !isMeteredProduct(selectedProduct)" class="quantity-section">
            <label class="quantity-label" for="quantity-selector">Quantity:</label>
            <QuantitySelector
              id="quantity-selector"
              v-model="dialogQuantity"
              :min="1"
              :max="99"
              size="md"
              @update:model-value="updateDialogQuantity"
            />
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <BaseButton
        v-if="selectedProduct && !productQuantities[selectedProduct.id]"
        variant="primary"
        size="lg"
        @click="confirmAddToCart"
      >
        Add to Cart
      </BaseButton>
      <BaseButton v-else variant="danger" size="lg" @click="removeProductFromCart">
        Remove from Cart
      </BaseButton>
    </template>
  </BaseModal>
</template>
<script setup lang="ts">
import { generateEmbedCode } from '@/utils/embedScript'
import type { Product } from '@marketplace/types'
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import BaseAlert from './BaseAlert.vue'
import BaseButton from './BaseButton.vue'
import BaseModal from './BaseModal.vue'
import ImageCarousel from './ImageCarousel.vue'
import PriceDisplay from './PriceDisplay.vue'
import ProductBadge from './ProductBadge.vue'
import ProductCard from './ProductCard.vue'
import QuantitySelector from './QuantitySeletor.vue'

interface Props {
  products?: Product[]
  purchasable?: boolean
  shareable?: boolean
  editable?: boolean
  variant?: 'carousel' | 'grid' | 'list'
  viewMode?: 'full' | 'image' | 'compact'
}

const {
  products = [],
  purchasable = true,
  shareable = false,
  editable = false,
  variant = 'carousel',
  viewMode = 'full',
} = defineProps<Props>()

const emit = defineEmits<{
  purchaseSuccess: [product: Product]
  purchaseError: [error: string]
  click: [product: Product]
}>()

const showConfirmDialog = ref(false)
const confirmDialogRef = ref<InstanceType<typeof BaseModal> | null>(null)
const selectedProduct = ref<Product | null>(null)
const dialogQuantity = ref(1)
const copyFeedback = ref<{ productId: string; action: 'share' | 'embed' } | null>(null)

const carouselTrack = ref<HTMLElement | null>(null)
const canScrollPrev = ref(false)
const canScrollNext = ref(false)
const currentPage = ref(0)
const cardWidth = ref(340) // Base card width + gap
const cardsPerView = ref(1)

// Cart management
const productQuantities = ref<Record<string, number>>({})

const isMeteredProduct = (product: Product) => {
  return product.default_price_data?.recurring?.usage_type === 'metered'
}

// Cart management with localStorage
const getCartStorageKey = () => {
  return `cart_${window.location.hostname}`
}

const getCart = (): Record<
  string,
  { groupId: string; productId: string; quantity: number; organizationId: string }
> => {
  try {
    const cartData = localStorage.getItem(getCartStorageKey())
    return cartData ? JSON.parse(cartData) : {}
  } catch (error) {
    console.error('Error reading cart from localStorage:', error)
    return {}
  }
}

const saveCart = (
  cart: Record<
    string,
    { groupId: string; productId: string; quantity: number; organizationId: string }
  >,
) => {
  try {
    localStorage.setItem(getCartStorageKey(), JSON.stringify(cart))
    // Dispatch custom event to notify other components
    window.dispatchEvent(new Event('cartUpdated'))
  } catch (error) {
    console.error('Error saving cart to localStorage:', error)
  }
}

const addToCart = (product: Product, quantityDelta: number) => {
  if (!product.group_id || !product.id) return

  try {
    const cart = getCart()
    const itemKey = `${product.group_id}_${product.id}`

    if (cart[itemKey]) {
      if (!isMeteredProduct(product)) {
        cart[itemKey].quantity += quantityDelta
      }
    } else {
      cart[itemKey] = {
        groupId: product.group_id,
        productId: product.id,
        quantity: quantityDelta,
        organizationId: product.organization_id,
      }
    }

    if (cart[itemKey].quantity <= 0) {
      delete cart[itemKey]
    }

    saveCart(cart)
  } catch (error) {
    console.error('Error adding to cart:', error)
  }
}

const removeFromCart = (product: Product, quantityDelta: number) => {
  if (!product.group_id || !product.id) return

  try {
    const cart = getCart()
    const itemKey = `${product.group_id}_${product.id}`

    if (cart[itemKey]) {
      cart[itemKey].quantity -= quantityDelta
      if (cart[itemKey].quantity <= 0) {
        delete cart[itemKey]
      }
    }

    saveCart(cart)
  } catch (error) {
    console.error('Error removing from cart:', error)
  }
}

const initializeCartQuantities = () => {
  const cart = getCart()
  products.forEach((product) => {
    if (product.group_id && product.id) {
      const itemKey = `${product.group_id}_${product.id}`
      const existingItem = cart[itemKey]
      if (existingItem && existingItem.quantity > 0) {
        productQuantities.value[product.id] = existingItem.quantity
      }
    }
  })
}
const handlePurchaseClick = (product: Product) => {
  emit('click', product)
  if (!purchasable) return

  // Open dialog for product selection
  selectedProduct.value = product
  dialogQuantity.value = productQuantities.value[product.id] || 1
  showConfirmDialog.value = true
}

const handleModalClose = () => {
  // This is called after the modal's close animation completes
  // Reset state
  selectedProduct.value = null
  dialogQuantity.value = 1
}


const updateDialogQuantity = (newQuantity: number) => {
  if (!selectedProduct.value) return

  const product = selectedProduct.value
  const currentQuantity = productQuantities.value[product.id] || 0

  // Update the product quantity in memory
  productQuantities.value[product.id] = newQuantity

  // Update cart storage immediately
  const quantityDelta = newQuantity - currentQuantity
  if (quantityDelta > 0) {
    addToCart(product, quantityDelta)
  } else if (quantityDelta < 0) {
    removeFromCart(product, Math.abs(quantityDelta))
  }
}

const confirmAddToCart = () => {
  if (!selectedProduct.value) return

  const product = selectedProduct.value
  const currentQuantity = productQuantities.value[product.id] || 0
  const newQuantity = isMeteredProduct(product) ? 1 : dialogQuantity.value

  // Update the product quantity
  productQuantities.value[product.id] = newQuantity

  // Update cart storage
  const quantityDelta = newQuantity - currentQuantity
  if (quantityDelta > 0) {
    addToCart(product, quantityDelta)
  } else if (quantityDelta < 0) {
    removeFromCart(product, Math.abs(quantityDelta))
  }

  // Close the dialog with animation
  confirmDialogRef.value?.close()
}

const removeProductFromCart = () => {
  if (!selectedProduct.value) return

  const product = selectedProduct.value
  const currentQuantity = productQuantities.value[product.id] || 0

  // Remove all quantities from cart
  if (currentQuantity > 0) {
    removeFromCart(product, currentQuantity)
    productQuantities.value[product.id] = 0
    delete productQuantities.value[product.id]
  }

  // Close the dialog with animation
  confirmDialogRef.value?.close()
}

const shareProduct = async (product: Product) => {
  const shareUrl = `${window.location.origin}/public/${product.group_id}/${product.id}`

  try {
    await navigator.clipboard.writeText(shareUrl)
    copyFeedback.value = { productId: product.id, action: 'share' }
    setTimeout(() => {
      copyFeedback.value = null
    }, 2000)
  } catch (err) {
    console.error('Failed to copy share link:', err)
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = shareUrl
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    copyFeedback.value = { productId: product.id, action: 'share' }
    setTimeout(() => {
      copyFeedback.value = null
    }, 2000)
  }
}

const embedProduct = async (product: Product) => {
  const shareUrl = `${window.location.origin}/public/${product.group_id}/${product.id}`
  const embedCode = await generateEmbedCode(shareUrl)

  try {
    await navigator.clipboard.writeText(embedCode)
    copyFeedback.value = { productId: product.id, action: 'embed' }
    setTimeout(() => {
      copyFeedback.value = null
    }, 2000)
  } catch (err) {
    console.error('Failed to copy embed code:', err)
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = embedCode
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    copyFeedback.value = { productId: product.id, action: 'embed' }
    setTimeout(() => {
      copyFeedback.value = null
    }, 2000)
  }
}

const updateCarouselState = () => {
  if (!carouselTrack.value) return

  const { scrollLeft, scrollWidth, clientWidth } = carouselTrack.value

  canScrollPrev.value = scrollLeft > 10
  canScrollNext.value = scrollLeft < scrollWidth - clientWidth - 10
  if (products.length <= 1) {
    canScrollPrev.value = false
    canScrollNext.value = false
  }

  // Find which card is currently centered
  let closestIndex = 0
  let closestDistance = Infinity
  const centerPoint = scrollLeft + clientWidth / 2

  for (let i = 0; i < products.length; i++) {
    const cardElement = carouselTrack.value.children[i] as HTMLElement
    if (cardElement) {
      const cardCenter = cardElement.offsetLeft + cardElement.offsetWidth / 2
      const distance = Math.abs(centerPoint - cardCenter)
      if (distance < closestDistance) {
        closestDistance = distance
        closestIndex = i
      }
    }
  }
  currentPage.value = closestIndex
}

const handleScroll = () => {
  updateCarouselState()
}

const scrollToCard = (cardIndex: number) => {
  if (!carouselTrack.value) return
  const containerWidth = carouselTrack.value.clientWidth
  const cardElement = carouselTrack.value.children[cardIndex] as HTMLElement
  if (cardElement) {
    const cardOffset = cardElement.offsetLeft
    const cardWidth = cardElement.offsetWidth
    const centerPosition = cardOffset - containerWidth / 2 + cardWidth / 2
    carouselTrack.value.scrollTo({ left: centerPosition, behavior: 'smooth' })
  }
}

const scrollPrev = () => {
  if (!carouselTrack.value) return
  const currentIndex = currentPage.value
  if (currentIndex > 0) {
    scrollToCard(currentIndex - 1)
  }
}

const scrollNext = () => {
  if (!carouselTrack.value) return
  const currentIndex = currentPage.value
  if (currentIndex < products.length - 1) {
    scrollToCard(currentIndex + 1)
  }
}

const updateCardsPerView = () => {
  if (!carouselTrack.value) return

  const containerWidth = carouselTrack.value.clientWidth
  const availableWidth = containerWidth
  const newCardsPerView = Math.floor(availableWidth / cardWidth.value)
  cardsPerView.value = Math.max(1, newCardsPerView)

  nextTick(() => {
    updateCarouselState()
  })
}

const handleResize = () => {
  updateCardsPerView()
}

onMounted(() => {
  initializeCartQuantities()

  nextTick(() => {
    updateCardsPerView()
    // Center the first card on mount
    setTimeout(() => {
      if (carouselTrack.value && products.length > 0) {
        scrollToCard(0)
      }
    }, 100)
  })
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.products-list {
  position: relative;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  min-width: 0;
  overflow-x: hidden;
}

.carousel-container {
  position: relative;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  min-width: 0;
  overflow-x: hidden;
}

.grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr));
  gap: var(--space-4);
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.list-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.list-item {
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.carousel-track {
  display: flex;
  align-items: stretch;
  overflow-x: auto;
  scroll-behavior: smooth;
  scrollbar-width: none;
  -ms-overflow-style: none;
  width: 100%;
  padding: var(--space-2) 0;
  scroll-snap-type: x mandatory;
  box-sizing: border-box;
}

.carousel-item {
  scroll-snap-align: center;
  margin-right: var(--space-6);
  border-radius: var(--radius-lg);
  flex-shrink: 0;
  width: min(320px, 85vw);
}

.carousel-item:first-child {
  margin-left: var(--space-4);
}

.carousel-item:last-child {
  margin-right: var(--space-4);
}

@media (min-width: 768px) {
  .carousel-item {
    width: 320px;
  }
}

.carousel-track::-webkit-scrollbar {
  display: none;
}

.carousel-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: none;
  color: var(--color-text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 10;
}

.carousel-nav--prev {
  left: var(--space-4);
}

.carousel-nav--next {
  right: var(--space-4);
}

.carousel-nav:hover:not(:disabled) {
  background: var(--color-bg-secondary);
  border-color: var(--color-primary);
  transform: translateY(-50%) scale(1.05);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
}

.carousel-nav:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  background: var(--color-bg-muted);
  color: var(--color-text-disabled);
  border-color: var(--color-border-muted);
}

.carousel-nav svg {
  transition: transform 0.2s ease;
}

.carousel-nav:hover:not(:disabled) svg {
  transform: scale(1.1);
}

.product-action-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  opacity: 0.7;
  transition: all 0.2s ease;
}

.carousel-item:hover .product-action-hint {
  opacity: 1;
}

.action-text {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.action-arrow {
  transition: transform 0.2s ease;
  color: var(--color-text-secondary);
}

.carousel-item:hover .action-arrow {
  transform: translateX(2px);
}

.product-share-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
}

.product-cart-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
}

.add-to-cart-btn {
  font-size: var(--font-size-sm);
  padding: var(--space-2) var(--space-3);
}

.share-btn,
.embed-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-xs);
  padding: var(--space-1) var(--space-2);
  min-height: 28px;
  transition: all 0.2s ease;
}

.share-btn.copied,
.embed-btn.copied {
  background-color: var(--color-success-bg, #dcfce7);
  border-color: var(--color-success, #16a34a);
  color: var(--color-success, #16a34a);
}

.share-btn svg,
.embed-btn svg {
  flex-shrink: 0;
  transform: translateY(2px);
}

/* Modal Layout */
.modal-content-wrapper {
  display: flex;
  flex-direction: row;
  gap: var(--space-6);
  align-items: start;
}

.product-info-column {
  flex: 1;
  min-width: 0;
  margin: auto;
}

.pricing-column {
  flex-shrink: 0;
  width: 350px;
  position: sticky;
  top: 0;
}

/* Product Header Section */
.product-header-section {
  display: flex;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
  padding-bottom: var(--space-6);
  border-bottom: 1px solid var(--color-border);
}

.product-image-placeholder {
  flex-shrink: 0;
  width: 120px;
  height: 120px;
  border-radius: var(--radius-md);
  background: var(--color-bg-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}

.product-header-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  justify-content: center;
}

.product-name {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin: 0;
  line-height: var(--line-height-tight);
}

.product-badge-modal {
  align-self: flex-start;
}

/* Product Description Section */
.product-description-section {
  margin-bottom: var(--space-6);
}

.product-full-description {
  color: var(--color-text-secondary);
  line-height: var(--line-height-relaxed);
  margin: 0;
  font-size: var(--font-size-base);
}

/* Product Features Section */
.product-features-section {
  margin-bottom: var(--space-6);
  padding: var(--space-4);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.section-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-3) 0;
}

.product-features-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.product-features-list li {
  position: relative;
  padding-left: var(--space-5);
  margin-bottom: var(--space-2);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
}

.product-features-list li:last-child {
  margin-bottom: 0;
}

.product-features-list li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: var(--color-primary);
  font-weight: var(--font-weight-bold);
}

/* Quantity Section */
.quantity-section {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
  padding: var(--space-4);
  background: var(--color-bg-muted);
  border-radius: var(--radius-md);
}

.quantity-label {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

/* Price Summary Section */
.price-summary-section {
  margin-bottom: var(--space-6);
  padding: var(--space-5);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.price-breakdown {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-4);
}

.price-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.price-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
}

.price-value {
  display: flex;
  justify-content: flex-end;
  font-weight: var(--font-weight-semibold);
}

.total-line {
  border-top: 2px solid var(--color-border);
  padding-top: var(--space-3);
  margin-top: var(--space-2);
}

.total-line .price-label {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.price-amount {
  display: flex;
  justify-content: flex-end;
}

/* Billing Notice */
.billing-notice {
  margin-bottom: var(--space-4);
}

.carousel-indicators {
  display: flex;
  justify-content: center;
  gap: var(--space-2);
  margin-top: var(--space-6);
}

.carousel-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: none;
  background: var(--color-border);
  cursor: pointer;
  transition: all 0.2s ease;
}

.carousel-indicator--active {
  background: var(--color-primary);
  transform: scale(1.25);
}

.carousel-indicator:hover {
  background: var(--color-primary);
  opacity: 0.7;
}

@media (max-width: 768px) {
  .carousel-nav {
    width: 36px;
    height: 36px;
  }

  .carousel-nav--prev {
    left: var(--space-2);
  }

  .carousel-nav--next {
    right: var(--space-2);
  }

  .modal-content-wrapper {
    flex-direction: column;
  }

  .pricing-column {
    width: 100%;
    position: static;
  }

  .product-header-section {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .product-header-info {
    align-items: center;
  }

  .product-badge-modal {
    align-self: center;
  }

  .quantity-section {
    flex-direction: column;
    align-items: stretch;
  }

  .price-summary-section {
    padding: var(--space-4);
  }
}
.no-payment-method-warning {
  font-size: var(--font-size-sm);
  background: var(--color-warning-bg);
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--color-error);
}
</style>
