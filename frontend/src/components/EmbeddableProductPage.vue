<template>
  <div
    class="embeddable-product-page"
    :class="{ 'embeddable-product-page--standalone': !isEmbedded }"
  >
    <div v-if="loading" class="loading">
      <LoadingSpinner :size="64" />
    </div>

    <div v-else-if="product" class="product-container">
      <!-- Product Content -->
      <div class="product-content">
        <!-- Product Type Badge -->

        <!-- Product Images -->
        <div v-if="product.images && product.images.length > 0" class="product-images">
          <ImageCarousel :images="product.images" :alt="product.name" size="lg" />
        </div>

        <!-- Product Details -->
        <div class="product-details">
          <div class="product-header">
            <h1 class="product-title">{{ product.name }}</h1>
          </div>

          <div class="product-description" v-if="product.description">
            {{ product.description }}
          </div>

          <!-- Marketing Features -->
          <div
            v-if="product.marketing_features && product.marketing_features.length > 0"
            class="product-features"
          >
            <ul>
              <li v-for="feature in product.marketing_features" :key="feature.name">
                {{ feature.name }}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Quantity and Add to Cart Section -->
      <div class="purchase-section">
        <div class="badge-and-price">
          <div class="product-type-badge">
            <div
              class="product-badge"
              :class="{
                'product-badge--subscription':
                  product.default_price_data.recurring &&
                  product.default_price_data.recurring.usage_type !== 'metered',
                'product-badge--metered':
                  product.default_price_data.recurring &&
                  product.default_price_data.recurring.usage_type === 'metered',
                'product-badge--one-time': !product.default_price_data.recurring,
              }"
            >
              <!-- Subscription recurring icon -->
              <svg
                v-if="
                  product.default_price_data.recurring &&
                  product.default_price_data.recurring.usage_type !== 'metered'
                "
                class="badge-icon"
                width="12"
                height="12"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                  clip-rule="evenodd"
                />
              </svg>
              <!-- Metered billing icon -->
              <svg
                v-if="
                  product.default_price_data.recurring &&
                  product.default_price_data.recurring.usage_type === 'metered'
                "
                class="badge-icon"
                width="12"
                height="12"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 8a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 12a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 16a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                  clip-rule="evenodd"
                />
                <path d="M14 10l4 4-4 4V10z" fill="currentColor" />
              </svg>
              <svg
                v-else-if="!product.default_price_data.recurring"
                class="badge-icon"
                width="12"
                height="12"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clip-rule="evenodd"
                />
              </svg>
              <span class="badge-text">
                {{
                  product.default_price_data.recurring &&
                  product.default_price_data.recurring.usage_type === 'metered'
                    ? 'Metered'
                    : product.default_price_data.recurring
                      ? 'Subscription'
                      : 'One-time'
                }}
              </span>
            </div>
          </div>
          <PriceDisplay
            v-if="product.default_price_data"
            :amount="product.default_price_data.unit_amount * (quantity || 1)"
            :currency="product.default_price_data.currency"
            :recurring="!!product.default_price_data.recurring"
            :usage_type="product.default_price_data.recurring?.usage_type"
            :interval="product.default_price_data.recurring?.interval"
            :interval_count="product.default_price_data.recurring?.interval_count"
            :unit="product.default_price_data.unit_label"
            size="lg"
          />
        </div>
        <div class="add-to-cart-section">
          <div v-if="product && isProductSoldOut(product)" class="sold-out-badge">
            Sold Out
          </div>
          <template v-else>
            <QuantitySelector
              v-if="productInCart && !isMeteredProduct && product"
              :min="0"
              :max="getMaxPurchaseQuantity(product)"
              v-model.number="quantity"
            />
            <button
              v-if="productInCart"
              @click="openCart"
              class="view-cart-btn"
              aria-label="View Cart"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M7 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12L8.1 13h7.45c.75 0 1.41-.41 1.75-1.03L21.7 4H5.21l-.94-2H1zm16 16c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"
                />
              </svg>
              Checkout
            </button>
            <button v-else @click="initProductInCart" class="add-to-cart-btn">Add to Cart</button>
          </template>
        </div>
      </div>
    </div>

    <div v-else-if="error" class="error">
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import { publicApi } from '@/services/api'
import { getMaxPurchaseQuantity, isProductSoldOut } from '@/utils/product'
import type { Product } from '@marketplace/types'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import ImageCarousel from './ui/ImageCarousel.vue'
import PriceDisplay from './ui/PriceDisplay.vue'
import QuantitySelector from './ui/QuantitySelector.vue'

const route = useRoute()
const groupId = ref(
  Array.isArray(route.params.group_id) ? route.params.group_id[0] : (route.params.group_id ?? ''),
)
const productId = ref(Array.isArray(route.params.id) ? route.params.id[0] : (route.params.id ?? ''))

const product = ref<Product | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const quantity = ref(0)

const isEmbedded = window !== window.top
const lastSentHeight = ref(0)
const heightCheckTimeout = ref<number | null>(null)
const isUpdatingHeight = ref(false)
const productInCart = ref<boolean>(false)

const isMeteredProduct = computed(() => {
  return product.value?.default_price_data?.recurring?.usage_type === 'metered'
})

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
  } catch (error) {
    console.error('Error saving cart to localStorage:', error)
  }
}

// Auto-resize functionality for embedded iframe
const sendHeightToParent = () => {
  if (!isEmbedded || isUpdatingHeight.value) return

  // Clear any pending height checks to debounce
  if (heightCheckTimeout.value) {
    clearTimeout(heightCheckTimeout.value)
  }

  heightCheckTimeout.value = window.setTimeout(() => {
    isUpdatingHeight.value = true

    // Wait for any pending layout changes to complete
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Double RAF for more stable measurements
        const container = document.querySelector('.embeddable-product-page') as HTMLElement
        let height = 0

        if (container) {
          // Temporarily remove fixed height constraints to measure natural content size
          const originalMinHeight = container.style.minHeight
          const originalHeight = container.style.height
          container.style.minHeight = 'auto'
          container.style.height = 'auto'

          // Force reflow
          void container.offsetHeight

          // Get the actual content height without constraints
          const productContainer = container.querySelector('.product-container')
          let contentHeight = 0

          if (productContainer) {
            // Measure the actual product content
            const productRect = productContainer.getBoundingClientRect()
            contentHeight = Math.ceil(productRect.height)

            // Add container padding (should be var(--space-4) = 16px)
            const containerStyles = window.getComputedStyle(container)
            const paddingTop = parseInt(containerStyles.paddingTop) || 16
            const paddingBottom = parseInt(containerStyles.paddingBottom) || 16

            height = contentHeight + paddingTop + paddingBottom
          } else {
            // Fallback to container measurements
            const rect = container.getBoundingClientRect()
            height = Math.ceil(rect.height)
          }

          // Restore original styles
          container.style.minHeight = originalMinHeight
          container.style.height = originalHeight

          // Add small buffer to prevent scrollbars
          height += 5
        } else {
          // Fallback to document measurements
          height = Math.max(
            document.documentElement.scrollHeight,
            document.body.scrollHeight,
            document.documentElement.offsetHeight,
            document.body.offsetHeight,
          )
        }

        // Always send height updates for significant changes
        if (Math.abs(height - lastSentHeight.value) > 2) {
          lastSentHeight.value = height
          // Include iframe source URL to identify which iframe should resize
          window.parent.postMessage(
            {
              type: 'resize',
              height,
              source: window.location.href,
            },
            '*',
          )
        }

        // Reset the flag after a delay to allow for new updates
        setTimeout(() => {
          isUpdatingHeight.value = false
        }, 100)
      })
    })
  }, 100) // Reduced debounce for faster response
}

const initProductInCart = () => {
  // Don't allow adding sold out products to cart
  if (product.value && isProductSoldOut(product.value)) return

  productInCart.value = true
  quantity.value = 1
}

// Use a flag to track if we should skip the next quantity change (during initialization)
const skipNextQuantityWatch = ref(false)

watch(quantity, (newQuantity, oldQuantity) => {
  // Skip this watch cycle if we're in initialization
  if (skipNextQuantityWatch.value) {
    skipNextQuantityWatch.value = false
    return
  }

  // For metered products, force quantity to 1
  if (isMeteredProduct.value && newQuantity !== 1 && productInCart.value) {
    quantity.value = 1
    return
  }

  if (newQuantity - oldQuantity > 0) {
    for (let i = 0; i < newQuantity - oldQuantity; i++) {
      addToCart()
    }
  } else if (newQuantity - oldQuantity < 0) {
    for (let i = 0; i < oldQuantity - newQuantity; i++) {
      removeFromCart()
    }
  }
  if (newQuantity === 0) {
    productInCart.value = false
  }
})

const addToCart = () => {
  if (groupId.value && productId.value && product.value) {
    // Don't allow adding sold out products to cart
    if (isProductSoldOut(product.value)) return

    try {
      const cart = getCart()
      const itemKey = `${groupId.value}_${productId.value}`

      if (cart[itemKey]) {
        // For metered products, don't increment quantity
        if (!isMeteredProduct.value) {
          cart[itemKey].quantity += 1
        }
      } else {
        cart[itemKey] = {
          groupId: groupId.value,
          productId: productId.value,
          quantity: 1,
          organizationId: product.value.organization_id,
        }
      }

      saveCart(cart)
    } catch (error) {
      console.error('Error adding to cart:', error)
    }
  }
}
const removeFromCart = () => {
  if (groupId.value && productId.value) {
    try {
      const cart = getCart()
      const itemKey = `${groupId.value}_${productId.value}`

      if (cart[itemKey]) {
        cart[itemKey].quantity -= 1
        if (cart[itemKey].quantity <= 0) {
          delete cart[itemKey]
        }
      }

      saveCart(cart)
    } catch (error) {
      console.error('Error removing from cart:', error)
    }
  }
}

const openCart = () => {
  const cart = getCart()
  const cartItems = Object.values(cart)

  if (cartItems.length > 0) {
    const cartUrl = new URL(`${window.location.origin}/cart`)

    // Encode cart data for URL
    const checkoutData = {
      items: cartItems,
      timestamp: Date.now(),
      domain: window.location.hostname,
      source: window.location.href,
    }
    const encodedCart = btoa(JSON.stringify(checkoutData))

    cartUrl.searchParams.set('cart', encodedCart)
    cartUrl.searchParams.set('source', encodeURIComponent(window.location.href))

    window.open(cartUrl.toString(), '_blank')
  } else {
    // If no items in cart, just open basic cart page
    window.open('/cart', '_blank')
  }
}

onMounted(async () => {
  if (!groupId.value || !productId.value) {
    error.value = 'Missing product parameters'
    loading.value = false
    sendHeightToParent()
    return
  }

  // Initialize cart state from localStorage
  const cart = getCart()
  const itemKey = `${groupId.value}_${productId.value}`
  const existingItem = cart[itemKey]

  if (existingItem && existingItem.quantity > 0) {
    productInCart.value = true
    skipNextQuantityWatch.value = true
    quantity.value = existingItem.quantity
  }

  try {
    const productResponse = await publicApi.getPublicProduct(groupId.value, productId.value)
    product.value = productResponse
  } catch (err: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    error.value = (err as any)?.response?.data?.message || 'Failed to load product'
  } finally {
    loading.value = false
    // Send height after content is loaded with multiple checks
    setTimeout(sendHeightToParent, 50)
    setTimeout(sendHeightToParent, 200)
    setTimeout(sendHeightToParent, 500)
  }

  // Set up observers to handle dynamic content changes
  if (isEmbedded) {
    let resizeObserver: ResizeObserver | null = null

    // Simple approach - just observe window resize and initial load
    const container = document.querySelector('.embeddable-product-page')
    if (container) {
      // Only observe for window resize events, not container changes
      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0]
        if (entry && entry.contentRect) {
          // Only update on significant width changes (viewport resize)
          const widthChanged =
            Math.abs(entry.contentRect.width - (container as HTMLElement).offsetWidth) > 10
          if (widthChanged) {
            setTimeout(sendHeightToParent, 300) // Wait for layout to settle
          }
        }
      })
      // Observe window instead of container to avoid loops
      if (document.body) {
        resizeObserver.observe(document.body)
      }
    }

    // Listen for image loads which might change content height
    const handleImageLoad = () => {
      setTimeout(sendHeightToParent, 100)
    }
    document.addEventListener('load', handleImageLoad, true)

    // Watch for viewport orientation/size changes that affect mobile layout
    const handleViewportChange = () => {
      setTimeout(sendHeightToParent, 200) // Longer delay for layout changes
    }
    window.addEventListener('orientationchange', handleViewportChange)
    window.addEventListener('resize', handleViewportChange)

    // Cleanup function for when component unmounts
    const cleanup = () => {
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
      document.removeEventListener('load', handleImageLoad, true)
      window.removeEventListener('orientationchange', handleViewportChange)
      window.removeEventListener('resize', handleViewportChange)
      if (heightCheckTimeout.value) {
        clearTimeout(heightCheckTimeout.value)
      }
    }

    // Store cleanup function for potential future use
    ;(window as Window & { __embeddedCleanup?: () => void }).__embeddedCleanup = cleanup
  }
})
</script>

<style scoped>
:global(html, body) {
  margin: 0;
  padding: 0;
  overflow-x: hidden;
  min-height: 100%;
  height: auto;
}
.embeddable-product-page {
  padding: var(--space-4);
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--color-bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  border: 2px solid var(--color-border);
  transition: all 0.3s ease;
  overflow: visible;
  width: 100%;
  box-sizing: border-box;
  height: auto;
}

.embeddable-product-page--standalone {
  margin: var(--space-8) auto;
  max-width: 1200px;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-12);
  color: var(--color-text-secondary);
  font-size: var(--font-size-lg);
}

.error {
  text-align: center;
  padding: var(--space-12);
  color: var(--color-error);
  font-size: var(--font-size-lg);
  background: var(--color-error-bg);
  border-radius: var(--radius-md);
  border-left: 4px solid var(--color-error);
}

.product-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  position: relative;
}

.product-content {
  display: flex;
  flex-direction: row;
  gap: var(--space-8);
}

.badge-and-price {
  display: flex;
  flex-direction: row;
  width: 100%;
  justify-content: space-between;
}

.product-type-badge {
  justify-content: flex-end;
}

.product-badge {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.product-badge--subscription {
  background: var(--color-subscription-bg);
  color: var(--color-subscription);
  border: 1px solid var(--color-subscription-border);
}

.product-badge--one-time {
  background: var(--color-onetime-bg);
  color: var(--color-onetime);
  border: 1px solid var(--color-onetime-border);
}

.product-badge--metered {
  background: var(--color-metered-bg);
  color: var(--color-metered);
  border: 1px solid var(--color-metered-border);
}

.badge-icon {
  flex-shrink: 0;
}

.badge-text {
  font-size: var(--font-size-xs);
}

.product-images {
  order: 2;
  flex: 0 0 300px;
}

.add-to-cart-section {
  display: flex;
  flex: 1;
  justify-content: flex-end;
  align-items: center;
  min-height: 44px;
  position: relative;
}

.sold-out-badge {
  background: var(--color-error-bg, rgba(220, 38, 38, 0.1));
  color: var(--color-error, #dc2626);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  border: 1px solid var(--color-error, #dc2626);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.add-to-cart-btn {
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 120px;
}

.add-to-cart-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.add-to-cart-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.add-to-cart-btn--hidden {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

.view-cart-btn {
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 120px;
  justify-content: center;
  margin-left: var(--space-3);
}

.view-cart-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  opacity: 0.9;
}

.view-cart-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.product-details {
  flex: 1;
  order: 1;
}

.product-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-6);
  gap: var(--space-4);
}

.product-title {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  margin: 0;
  color: var(--color-text-primary);
  line-height: var(--line-height-tight);
  flex: 1;
}

.product-description {
  color: var(--color-text-secondary);
  line-height: var(--line-height-relaxed);
  margin: 0 0 var(--space-6) 0;
  font-size: var(--font-size-base);
}

.product-features {
  margin-bottom: var(--space-6);
}

.product-features ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.product-features li {
  position: relative;
  padding-left: var(--space-5);
  margin-bottom: var(--space-2);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
}

.product-features li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: var(--color-primary);
  font-weight: var(--font-weight-bold);
}

.metadata {
  margin: var(--space-6) 0;
  padding: var(--space-5);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.metadata h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  margin: 0 0 var(--space-3) 0;
  color: var(--color-text-primary);
}

.metadata-item {
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
  color: var(--color-text-secondary);
  margin: var(--space-2) 0;
  display: flex;
  gap: var(--space-2);
}

.metadata-item strong {
  color: var(--color-text-primary);
  min-width: 120px;
  font-weight: var(--font-weight-medium);
}

.purchase-section {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-6);
}

.quantity-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.quantity-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

@media (max-width: 767px) {
  .product-content {
    flex-direction: column;
    align-items: center;
  }

  .product-images {
    order: 1;
    flex: none;
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .product-details {
    order: 2;
    flex: none;
    width: 100%;
  }

  .purchase-section {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-4);
  }

  .add-to-cart-section {
    flex-direction: column;
    gap: var(--space-3);
  }

  .embeddable-product-page {
    padding: var(--space-4);
    margin: 0;
  }

  .carousel-image {
    width: 300px;
    height: 300px;
  }

  .product-title {
    font-size: var(--font-size-2xl);
  }

  .product-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
  }

  .product-price {
    text-align: left;
    align-items: flex-start;
  }
}
</style>
