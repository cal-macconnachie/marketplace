<template>
  <div class="marketplace-page">
    <header class="marketplace-header" aria-label="Marketplace header">
      <div class="marketplace-header-controls">
        <div class="view-toggle">
          <button
            class="view-toggle-btn"
            :class="{ active: viewMode === 'full' }"
            @click="viewMode = 'full'"
            title="Full view"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <rect x="2" y="2" width="7" height="7" rx="1" />
              <rect x="11" y="2" width="7" height="7" rx="1" />
              <rect x="2" y="11" width="7" height="7" rx="1" />
              <rect x="11" y="11" width="7" height="7" rx="1" />
            </svg>
          </button>
          <button
            class="view-toggle-btn"
            :class="{ active: viewMode === 'image' }"
            @click="viewMode = 'image'"
            title="Image view"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <rect x="1" y="1" width="5" height="5" rx="1" />
              <rect x="7.5" y="1" width="5" height="5" rx="1" />
              <rect x="14" y="1" width="5" height="5" rx="1" />
              <rect x="1" y="7.5" width="5" height="5" rx="1" />
              <rect x="7.5" y="7.5" width="5" height="5" rx="1" />
              <rect x="14" y="7.5" width="5" height="5" rx="1" />
              <rect x="1" y="14" width="5" height="5" rx="1" />
              <rect x="7.5" y="14" width="5" height="5" rx="1" />
              <rect x="14" y="14" width="5" height="5" rx="1" />
            </svg>
          </button>
          <button
            class="view-toggle-btn"
            :class="{ active: viewMode === 'compact' }"
            @click="viewMode = 'compact'"
            title="Compact view"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <rect x="2" y="3" width="16" height="3" rx="1" />
              <rect x="2" y="8.5" width="16" height="3" rx="1" />
              <rect x="2" y="14" width="16" height="3" rx="1" />
            </svg>
          </button>
        </div>
        <ThemeToggle />
        <BaseButton
          v-if="!appStore.isAuthenticated"
          @click="showAuthForm = true"
          variant="primary"
          size="sm"
        >
          Sign In
        </BaseButton>
        <UserAvatar
          v-else
          :given-name="appStore.user?.given_name"
          :family-name="appStore.user?.family_name"
          :badge="appStore.unreadNotificationCount"
          size="md"
          @click="goToAccount"
        />
      </div>
    </header>

    <div v-if="loading && products.length === 0" class="loading-container">
      <LoadingSpinner :size="48" />
      <p>Loading products...</p>
    </div>

    <div v-else-if="error" class="error-container">
      <BaseAlert variant="error" @close="error = null">
        {{ error }}
        <template #actions>
          <BaseButton @click="fetchProducts(true)" size="xs" variant="ghost">Retry</BaseButton>
        </template>
      </BaseAlert>
    </div>

    <div v-else class="marketplace-content">
      <div v-if="!loading && products.length === 0" class="empty-state">
        <div class="empty-animation">
          <div class="bouncing-box"></div>
          <div class="bouncing-box delay-1"></div>
          <div class="bouncing-box delay-2"></div>
        </div>
        <h2 class="empty-title">Products Coming Soon!</h2>
        <p class="empty-description">We're preparing something amazing for you. Check back soon!</p>
      </div>

      <ProductsList
        v-else
        :products="products"
        variant="grid"
        :purchasable="true"
        :view-mode="viewMode"
        @purchaseSuccess="handlePurchaseSuccess"
        @purchaseError="handlePurchaseError"
      />

      <div v-if="hasMore" ref="loadMoreTrigger" class="load-more-trigger">
        <div v-if="loading" class="loading-more">
          <LoadingSpinner :size="32" />
          <p>Loading more products...</p>
        </div>
      </div>

      <div v-if="!hasMore && products.length > 0" class="end-message">
        <p>You've reached the end of the marketplace</p>
      </div>
    </div>

    <!-- Authentication Modal -->
    <BaseModal v-model:show="showAuthForm" size="sm" :hide-scrollbar="true" variant="drawer">
      <SignIn :initial-mode="authMode" :is-modal="true" @auth-success="handleAuthSuccess" />
    </BaseModal>

    <!-- Floating Cart Button -->
    <button
      v-if="cartItemCount > 0"
      class="cart-fab"
      @click="showCartModal = true"
      title="View Cart"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <circle cx="8" cy="21" r="1"></circle>
        <circle cx="19" cy="21" r="1"></circle>
        <path
          d="m2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43h-15.12"
        ></path>
      </svg>
      <span class="cart-fab-badge">{{ cartItemCount }}</span>
    </button>

    <!-- Privacy Policy Link -->
    <a
      href="https://privacy-policy.csm.codes/"
      target="_blank"
      rel="noopener noreferrer"
      class="privacy-link"
      title="Privacy Policy"
    >
      Privacy Policy
    </a>

    <!-- Cart Management Modal -->
    <BaseModal v-model:show="showCartModal" size="lg" :hide-scrollbar="false">
      <template #default>
        <div class="cart-modal-header">
          <h2 class="cart-modal-title">Shopping Cart</h2>
          <p class="cart-modal-subtitle">
            {{ cartItemCount }} {{ cartItemCount === 1 ? 'item' : 'items' }}
          </p>
        </div>

        <div v-if="cartItems.length === 0" class="empty-cart-message">
          <p>Your cart is empty</p>
        </div>

        <div v-else class="cart-modal-content">
          <div class="cart-items-section">
            <div class="cart-items-list">
              <div
                v-for="(item, index) in cartItems"
                :key="`${item.groupId}:${item.productId}`"
                class="cart-modal-item"
              >
                <div class="cart-item-wrapper">
                  <button class="remove-item-btn" @click="removeItem(index)" title="Remove item">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <polyline points="3,6 5,6 21,6"></polyline>
                      <path
                        d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"
                      ></path>
                      <line x1="10" y1="11" x2="10" y2="17"></line>
                      <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                  </button>
                  <ProductCard
                    v-if="productHash[`${item.groupId}:${item.productId}`]"
                    :product="productHash[`${item.groupId}:${item.productId}`]"
                    :compact="true"
                    :quantity="item.quantity"
                  >
                    <template #actions>
                      <div
                        class="quantity-container"
                        v-if="
                          !productHash[`${item.groupId}:${item.productId}`]?.default_price_data
                            ?.recurring ||
                          productHash[`${item.groupId}:${item.productId}`]?.default_price_data
                            ?.recurring?.usage_type !== 'metered'
                        "
                      >
                        <QuantitySelector
                          :min="1"
                          :max="
                            productHash[`${item.groupId}:${item.productId}`]
                              ? getMaxPurchaseQuantity(productHash[`${item.groupId}:${item.productId}`])
                              : 99
                          "
                          v-model.number="item.quantity"
                          size="xs"
                          @update:model-value="updateCartItemQuantity(item)"
                        />
                      </div>
                    </template>
                  </ProductCard>
                </div>
              </div>
            </div>
          </div>

          <div class="cart-modal-summary">
            <!-- One-time payments -->
            <template v-if="Object.keys(subtotalsByTypeAndCurrency.oneTime).length > 0">
              <div class="summary-section">
                <div
                  v-for="(amount, currency) in subtotalsByTypeAndCurrency.oneTime"
                  :key="`oneTime-${currency}`"
                  class="summary-row"
                >
                  <span class="summary-label">One-time Total:</span>
                  <span class="summary-value">
                    <PriceDisplay :amount="amount" :currency="currency" size="sm" />
                  </span>
                </div>
              </div>
            </template>

            <!-- Recurring payments -->
            <template v-if="Object.keys(subtotalsByTypeAndCurrency.recurring).length > 0">
              <div class="summary-section">
                <div
                  v-for="(recurringData, recurringKey) in subtotalsByTypeAndCurrency.recurring"
                  :key="`recurring-${recurringKey}`"
                  class="summary-row"
                >
                  <span class="summary-label">Recurring Total:</span>
                  <span class="summary-value">
                    <PriceDisplay
                      :amount="recurringData.amount"
                      :currency="recurringKey.split('-')[0]"
                      size="sm"
                      :recurring="true"
                      :interval="recurringData.interval"
                      :interval_count="recurringData.interval_count"
                      :usage_type="recurringData.usage_type"
                      :unit="recurringData.unit_label || recurringData.unit"
                    />
                  </span>
                </div>
              </div>
            </template>

            <div class="summary-row total-row">
              <span class="summary-label">Subtotal:</span>
              <span class="summary-value">
                <div v-for="(amount, currency) in totalDueNow" :key="`total-${currency}`">
                  <PriceDisplay :amount="amount" :currency="currency" size="md" />
                </div>
              </span>
            </div>
          </div>
        </div>
      </template>
      <template #footer v-if="cartItems.length > 0">
        <BaseButton @click="goToCheckout" variant="primary" size="lg" full-width>
          Proceed to Checkout
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { publicApi } from '@/services/api'
import { useAppStore } from '@/stores/app'
import { cartService } from '@/utils/cart'
import { getMaxPurchaseQuantity } from '@/utils/product'
import type { CartItem, Product } from '@marketplace/types'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import SignIn from './SignIn.vue'
import BaseAlert from './ui/BaseAlert.vue'
import BaseButton from './ui/BaseButton.vue'
import BaseModal from './ui/BaseModal.vue'
import LoadingSpinner from './ui/LoadingSpinner.vue'
import PriceDisplay from './ui/PriceDisplay.vue'
import ProductCard from './ui/ProductCard.vue'
import ProductsList from './ui/ProductsList.vue'
import QuantitySelector from './ui/QuantitySelector.vue'
import ThemeToggle from './ui/ThemeToggle.vue'
import UserAvatar from './ui/UserAvatar.vue'

const router = useRouter()
const appStore = useAppStore()

const products = ref<Product[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const hasMore = ref(true)
const lastEvaluatedKey = ref<{ [key: string]: string } | undefined>(undefined)
const loadMoreTrigger = ref<HTMLElement | null>(null)
const showAuthForm = ref(false)
const authMode = ref<'signin' | 'signup'>('signin')
const viewMode = ref<'full' | 'image' | 'compact'>('full')
const showCartModal = ref(false)
const cartItems = ref<CartItem[]>([])
const productHash = ref<Record<string, Product>>({})
const LIMIT = 20

// Cart management functions
const getCartStorageKey = () => {
  return `cart_${window.location.hostname}`
}

const getCart = (): Record<string, CartItem> => {
  try {
    const cartData = localStorage.getItem(getCartStorageKey())
    return cartData ? JSON.parse(cartData) : {}
  } catch (error) {
    console.error('Error reading cart from localStorage:', error)
    return {}
  }
}

const saveCart = (cart: Record<string, CartItem>) => {
  try {
    localStorage.setItem(getCartStorageKey(), JSON.stringify(cart))
    // Dispatch custom event to notify other components
    window.dispatchEvent(new Event('cartUpdated'))
  } catch (error) {
    console.error('Error saving cart to localStorage:', error)
  }
}

const loadCartItems = () => {
  const cart = getCart()
  cartItems.value = Object.values(cart)

  // Load product data for cart items
  cartItems.value.forEach(async (item) => {
    const key = `${item.groupId}:${item.productId}`
    if (!productHash.value[key]) {
      try {
        const product = await publicApi.getPublicProduct(item.groupId, item.productId)
        if (product) {
          productHash.value[key] = product
        }
      } catch (error) {
        console.error('Error loading product for cart:', error)
      }
    }
  })
}

const removeItem = (index: number) => {
  const removedItem = cartItems.value[index]
  cartItems.value.splice(index, 1)

  const cart = getCart()
  const itemKey = `${removedItem.groupId}_${removedItem.productId}`
  delete cart[itemKey]
  saveCart(cart)
}

const updateCartItemQuantity = (item: CartItem) => {
  const cart = getCart()
  const itemKey = `${item.groupId}_${item.productId}`

  if (cart[itemKey]) {
    cart[itemKey].quantity = item.quantity
    saveCart(cart)
  }
}

const goToCheckout = () => {
  // Only serialize cart if there are items
  if (cartItems.value.length === 0) {
    router.push('/cart')
    showCartModal.value = false
    return
  }

  try {
    // Generate cart URL with encoded cart data
    const encodedCart = cartService.serializeCart()
    router.push(`/cart?cart=${encodedCart}`)
    showCartModal.value = false
  } catch (error) {
    console.error('Error serializing cart:', error)
    // Fallback to basic cart page
    router.push('/cart')
    showCartModal.value = false
  }
}

// Computed properties
const cartItemCount = computed(() => {
  return cartItems.value.reduce((total, item) => {
    const product = productHash.value[`${item.groupId}:${item.productId}`]
    // For metered products, count as 1 item
    if (product?.default_price_data?.recurring?.usage_type === 'metered') {
      return total + 1
    }
    return total + item.quantity
  }, 0)
})

const subtotalsByTypeAndCurrency = computed(() => {
  const oneTime: Record<string, number> = {}
  const recurring: Record<
    string,
    {
      amount: number
      interval: 'day' | 'week' | 'month' | 'year'
      interval_count: number
      usage_type: 'licensed' | 'metered'
      unit?: string
      unit_label?: string
    }
  > = {}

  cartItems.value.forEach((item) => {
    const product = productHash.value[`${item.groupId}:${item.productId}`]
    if (product?.default_price_data) {
      const currency = product.default_price_data.currency
      const effectiveQuantity =
        product.default_price_data.recurring?.usage_type === 'metered' ? 1 : item.quantity
      const amount = product.default_price_data.unit_amount * effectiveQuantity

      if (product.default_price_data.recurring) {
        const interval = product.default_price_data.recurring.interval
        const interval_count = product.default_price_data.recurring.interval_count || 1
        const usage_type = product.default_price_data.recurring.usage_type || 'licensed'
        let unit = 'unit'
        const unit_label = product.default_price_data.unit_label
        if (usage_type === 'metered' && product.metadata?.unit) {
          unit = product.metadata.unit
        }

        const recurringKey = `${currency}-${interval}-${interval_count}-${usage_type}-${unit}`

        if (!recurring[recurringKey]) {
          recurring[recurringKey] = {
            amount: 0,
            interval,
            interval_count,
            usage_type,
            unit,
            unit_label,
          }
        }
        recurring[recurringKey].amount += amount
      } else {
        if (!oneTime[currency]) {
          oneTime[currency] = 0
        }
        oneTime[currency] += amount
      }
    }
  })

  return { oneTime, recurring }
})

const totalDueNow = computed(() => {
  const totals: Record<string, number> = {}

  cartItems.value.forEach((item) => {
    const product = productHash.value[`${item.groupId}:${item.productId}`]
    if (product?.default_price_data) {
      const currency = product.default_price_data.currency
      const effectiveQuantity =
        product.default_price_data.recurring?.usage_type === 'metered' ? 1 : item.quantity
      const amount = product.default_price_data.unit_amount * effectiveQuantity

      if (
        !product.default_price_data.recurring ||
        product.default_price_data.recurring.usage_type === 'licensed'
      ) {
        if (!totals[currency]) {
          totals[currency] = 0
        }
        totals[currency] += amount
      }
    }
  })

  return totals
})

const fetchProducts = async (reset = false, initialLoad = false) => {
  if (!initialLoad) {
    if (loading.value || (!hasMore.value && !reset)) return
  }

  try {
    loading.value = true
    error.value = null

    if (reset) {
      products.value = []
      lastEvaluatedKey.value = undefined
      hasMore.value = true
    }

    const response = await publicApi.fetchPublicProducts({
      exclusiveStartKey: lastEvaluatedKey.value,
      limit: LIMIT,
    })

    if (response.items) {
      products.value = [...products.value, ...response.items]
      lastEvaluatedKey.value = response.lastEvaluatedKey

      // Stop fetching if we got fewer items than requested
      if (!response.lastEvaluatedKey || response.items.length < LIMIT) {
        hasMore.value = false
      }
    } else {
      hasMore.value = false
    }
  } catch (err) {
    console.error('Failed to fetch products:', err)
    error.value = 'Failed to load products. Please try again.'
  } finally {
    loading.value = false
  }
}

const handlePurchaseSuccess = (product: Product) => {
  console.log('Purchase successful:', product)
  // You can add toast notification or other success handling here
}

const handlePurchaseError = (errorMessage: string) => {
  console.error('Purchase failed:', errorMessage)
  error.value = errorMessage
}

const handleAuthSuccess = async () => {
  showAuthForm.value = false
  // Ensure we have the latest user data after authentication
  await appStore.fetchCurrentUser()
}

const goToAccount = () => {
  router.push('/dashboard')
}

// Intersection Observer for infinite scroll
let observer: IntersectionObserver | null = null

const setupIntersectionObserver = () => {
  if (!loadMoreTrigger.value) return

  observer = new IntersectionObserver(
    (entries) => {
      const [entry] = entries
      if (entry.isIntersecting && hasMore.value && !loading.value) {
        fetchProducts()
      }
    },
    {
      root: null,
      rootMargin: '200px', // Start loading 200px before reaching the trigger
      threshold: 0.1,
    },
  )

  observer.observe(loadMoreTrigger.value)
}

// Watch for changes to localStorage cart
const handleStorageChange = (e: StorageEvent) => {
  if (e.key === getCartStorageKey()) {
    loadCartItems()
  }
}

// Watch for custom storage events from same window
const handleCartUpdate = () => {
  loadCartItems()
}

onMounted(async () => {
  // Initialize app store authentication
  await appStore.initializeAuth()

  // Load initial cart items
  loadCartItems()

  // Fetch unread notification count if user is authenticated
  if (appStore.isAuthenticated) {
    await appStore.fetchUnreadNotificationCount()
  }

  await fetchProducts(false, true)

  // Set up intersection observer after initial load
  if (loadMoreTrigger.value) {
    setupIntersectionObserver()
  }

  // Listen for storage changes from other windows
  window.addEventListener('storage', handleStorageChange)

  // Listen for cart updates from same window
  window.addEventListener('cartUpdated', handleCartUpdate)
})

onUnmounted(() => {
  if (observer && loadMoreTrigger.value) {
    observer.unobserve(loadMoreTrigger.value)
    observer.disconnect()
  }

  window.removeEventListener('storage', handleStorageChange)
  window.removeEventListener('cartUpdated', handleCartUpdate)
})

// Watch for product changes and update product hash
watch(products, (newProducts) => {
  newProducts.forEach((product) => {
    const key = `${product.group_id}:${product.id}`
    if (!productHash.value[key]) {
      productHash.value[key] = product
    }
  })
})
</script>

<style scoped>
.marketplace-page {
  min-height: 100dvh;
  background: var(--color-bg-secondary);
  position: relative;
}

.marketplace-header {
  margin: 0 auto;
  padding: var(--space-6) var(--space-4) var(--space-2);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-4);
}

.marketplace-header-controls {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.view-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  background: var(--color-bg-primary);
  border-radius: var(--radius-md);
  padding: var(--space-1);
  border: 1px solid var(--color-border);
}

.view-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s ease;
}

.view-toggle-btn:hover {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.view-toggle-btn.active {
  background: var(--color-primary);
  color: white;
}

.view-toggle-btn svg {
  flex-shrink: 0;
}

.marketplace-content {
  min-height: 400px;
  margin: 0 auto;
  padding: var(--space-8) var(--space-4);
}

/* Ensure grid items size correctly on this page only */
.marketplace-content :deep(.grid-container .product-card) {
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: var(--space-4);
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-8) var(--space-4);
}

.loading-container p {
  color: var(--color-text-secondary);
  margin: 0;
}

.load-more-trigger {
  min-height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: var(--space-6);
}

.loading-more {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}

.loading-more p {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  margin: 0;
}

.end-message {
  text-align: center;
  padding: var(--space-6) 0;
  margin-top: var(--space-6);
}

.end-message p {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  margin: 0;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60dvh;
  text-align: center;
  padding: var(--space-8);
}

.empty-animation {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-6);
}

.bouncing-box {
  width: 20px;
  height: 20px;
  background: var(--color-primary);
  border-radius: var(--radius-md);
  animation: bounce 1.4s ease-in-out infinite;
}

.bouncing-box.delay-1 {
  animation-delay: 0.2s;
}

.bouncing-box.delay-2 {
  animation-delay: 0.4s;
}

@keyframes bounce {
  0%,
  80%,
  100% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
  40% {
    transform: translateY(-30px) scale(1.1);
    opacity: 0.8;
  }
}

.empty-title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-3) 0;
}

.empty-description {
  font-size: var(--font-size-lg);
  color: var(--color-text-secondary);
  margin: 0;
  max-width: 500px;
}

/* Privacy Policy Link */
.privacy-link {
  position: fixed;
  bottom: var(--space-4);
  left: var(--space-4);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  text-decoration: none;
  transition: color 0.2s ease;
  z-index: 100;
  opacity: 0.7;
}

.privacy-link:hover {
  color: var(--color-text-primary);
  opacity: 1;
  text-decoration: underline;
}

/* Floating Cart Button */
.cart-fab {
  position: fixed;
  bottom: var(--space-6);
  right: var(--space-6);
  width: 64px;
  height: 64px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
  z-index: 100;
}

.cart-fab:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.cart-fab:active {
  transform: scale(0.95);
}

.cart-fab-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 var(--space-1);
  background: var(--color-error, #dc2626);
  color: white;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  border: 2px solid var(--color-bg-secondary);
}

.cart-modal-header {
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.cart-modal-title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-2) 0;
}

.cart-modal-subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
}

.empty-cart-message {
  text-align: center;
  padding: var(--space-12);
}

.empty-cart-message p {
  color: var(--color-text-secondary);
  font-size: var(--font-size-lg);
  margin: 0;
}

.cart-modal-content {
  display: flex;
  flex-direction: row;
  gap: var(--space-6);
  align-items: start;
}

.cart-items-section {
  flex: 1;
  min-width: 0;
}

.cart-items-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-4);
  max-height: 500px;
  overflow-y: auto;
  padding-top: var(--space-4);
  border-radius: var(--radius-md);
}

.cart-modal-item {
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.cart-item-wrapper {
  position: relative;
  display: inline-flex;
}

.cart-item-wrapper .remove-item-btn {
  position: absolute;
  top: -8px;
  left: -8px;
  z-index: 10;
  border: none;
  border-radius: var(--radius-full);
  color: var(--color-text-primary);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transform: scale(0.8);
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  background: var(--color-bg-primary);
}

.cart-item-wrapper:hover .remove-item-btn {
  opacity: 1;
  transform: scale(1);
}

.cart-item-wrapper .remove-item-btn:hover {
  background: rgba(220, 38, 38, 1);
  color: white;
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.cart-item-wrapper .remove-item-btn:active {
  transform: scale(0.95);
}

.quantity-container {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: right;
}

.cart-modal-summary {
  padding: var(--space-4);
  margin: var(--space-4);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  flex-shrink: 0;
  width: 350px;
}

.summary-section {
  margin-bottom: var(--space-3);
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) 0;
}

.summary-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
}

.summary-value {
  display: flex;
  justify-content: flex-end;
  font-weight: var(--font-weight-semibold);
}

.total-row {
  border-top: 2px solid var(--color-border);
  padding-top: var(--space-3);
  margin-top: var(--space-2);
}

.total-row .summary-label {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.error-container {
  max-width: 600px;
  margin: var(--space-8) auto;
  padding: 0 var(--space-4);
}

@media (max-width: 768px) {
  .marketplace-header {
    padding: var(--space-4) var(--space-3) var(--space-1);
  }

  .marketplace-content {
    padding: var(--space-4) var(--space-4);
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .marketplace-content :deep(.grid-container) {
    justify-content: center;
  }

  .loading-container {
    padding: var(--space-4) var(--space-2);
  }

  .header-content {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-4);
  }

  .header-text {
    text-align: center;
  }

  .header-actions {
    display: flex;
    justify-content: center;
  }

  .marketplace-header h1 {
    font-size: var(--font-size-2xl);
  }

  .marketplace-header p {
    font-size: var(--font-size-base);
  }

  .cart-fab {
    bottom: var(--space-4);
    right: var(--space-4);
    width: 56px;
    height: 56px;
  }

  .cart-fab-badge {
    min-width: 20px;
    height: 20px;
  }

  .privacy-link {
    bottom: var(--space-3);
    left: var(--space-3);
    font-size: 10px;
  }

  .cart-modal-content {
    flex-direction: column;
  }

  .cart-modal-summary {
    width: 100%;
  }

  .cart-items-list {
    grid-template-columns: 1fr;
    max-height: 400px;
    margin: var(--space-2);
    padding: var(--space-3);
  }
}
</style>
