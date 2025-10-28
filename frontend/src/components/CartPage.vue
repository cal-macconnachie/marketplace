<template>
  <div class="cart-page">
    <div class="container">
      <!-- Header -->
      <header class="cart-header">
        <div v-if="source" class="source-badge">From: {{ sourceHostname }}</div>
      </header>

      <!-- Error State -->
      <BaseAlert
        v-if="error"
        variant="error"
        title="Cart Error"
        :message="error"
        :show="true"
      />

      <!-- Purchase Complete Screen -->
      <PurchaseCompleteScreen
        v-else-if="showPurchaseComplete"
        :message="purchaseCompleteMessage"
        :referrer="source || undefined"
        :order-summary="purchaseOrderSummary"
      />

      <!-- Cart Content -->
      <div v-else class="cart-layout">
        <!-- Empty Cart -->
        <div v-if="cartItems.length === 0" class="empty-cart">
          <div class="empty-icon">
            <div class="empty-icon__scene">
              <div class="empty-icon__ground"></div>
              <div class="empty-icon__blocker empty-icon__blocker--left"></div>
              <div class="empty-icon__blocker empty-icon__blocker--right"></div>
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                class="empty-icon__cart"
              >
                <circle cx="8" cy="21" r="1"></circle>
                <circle cx="19" cy="21" r="1"></circle>
                <path
                  d="m2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43h-15.12"
                ></path>
              </svg>
            </div>
          </div>
          <h2>Your cart is empty</h2>
          <p>Add some products to get started with your purchase.</p>

          <BaseButton @click="goBack" variant="primary" size="md" class="back-to-products-btn">
            Back to Products
          </BaseButton>
        </div>

        <!-- Cart Items -->
        <div v-else class="cart-content">
          <!-- Checkout Section -->
          <div class="checkout-section">
            <BaseCard class="checkout-card">
              <h2 class="section-title">Checkout</h2>

              <!-- Authentication Status -->
              <div v-if="appStore.isAuthenticated" class="auth-status authenticated">
                <div class="auth-icon">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </div>
                <div class="auth-info">
                  <p class="auth-label">Signed in as</p>
                  <p class="auth-name">{{ appStore.fullName }}</p>
                </div>
              </div>

              <!-- Payment Method Section -->
              <div class="payment-section">
                <!-- Loading payment methods (show when authenticated and either loading OR haven't loaded yet) -->

              <div v-if="productsLoading" class="loading-state">
                <LoadingSpinner size="24" />
              </div>
                <div
                  v-else-if="
                    appStore.isAuthenticated &&
                    (appStore.paymentMethodsLoading ||
                      (!appStore.hasPaymentMethods &&
                        appStore.paymentMethods.length === 0 &&
                        !paymentMethodsInitialized))
                  "
                  class="payment-loading"
                >
                  <LoadingSpinner size="32" />
                  <p class="loading-text">Loading payment methods...</p>
                </div>

                <!-- Logged in user with existing payment method -->
                <div
                  v-else-if="appStore.isAuthenticated && appStore.hasPaymentMethods"
                  class="existing-payment"
                >
                  <AddressSearch
                    class="address-search"
                    label="Billing Address"
                    :value="formatAddress(appStore.user?.address ?? {}) || ''"
                    field="address"
                    @update="handleFieldUpdate"
                    :loading="fieldUpdating === 'address'"
                  />
                  <AddressSearch
                    v-if="requiresShipping"
                    class="address-search"
                    label="Shipping Address"
                    :value="formatAddress(shippingAddress ?? appStore.user?.address ?? {}) || ''"
                    field="shippingAddress"
                    @update="handleShippingAddressUpdate"
                    :loading="fieldUpdating === 'shippingAddress'"
                  />
                  <PaymentMethodList
                    :payment-methods="appStore.paymentMethods"
                    :show-selection="true"
                    :selected-payment-method-id="selectedPaymentMethod?.id"
                    @payment-method-selected="handlePaymentMethodSelected"
                  />
                </div>

                <!-- Logged in user without payment method -->
                <div v-else-if="appStore.isAuthenticated" class="add-payment-method">
                  <AddressSearch
                    label="Billing Address"
                    :value="formatAddress(appStore.user?.address ?? {}) || ''"
                    field="address"
                    @update="handleFieldUpdate"
                    :loading="fieldUpdating === 'address'"
                  />
                  <AddressSearch
                    v-if="requiresShipping"
                    class="address-search"
                    label="Shipping Address"
                    :value="formatAddress(shippingAddress ?? appStore.user?.address ?? {}) || ''"
                    field="shippingAddress"
                    @update="handleShippingAddressUpdate"
                    :loading="fieldUpdating === 'shippingAddress'"
                  />
                  <PaymentMethodForm
                    :has-existing-payment-method="false"
                    @payment-method-added="handlePaymentMethodAdded"
                  />
                </div>

                <!-- Guest user - default to showing auth options -->
                <div v-else class="guest-payment-section">
                  <!-- Default auth section -->
                  <div v-if="!showGuestCheckout" class="default-auth-section">
                    <div class="auth-prompt">
                      <div class="auth-icon primary">
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                          <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                      </div>
                      <div class="auth-message">
                        <h3>Sign in or Create Account</h3>
                        <p v-if="hasSubscriptionItems">
                          Your cart contains subscription items. An account is required to manage
                          your subscriptions.
                        </p>
                        <p v-else>
                          Sign in to save your payment information and track your orders.
                        </p>
                        <div class="auth-actions">
                          <BaseButton
                            @click="
                              () => {
                                authMode = 'signin'
                                showAuthForm = true
                              }
                            "
                            variant="primary"
                            size="sm"
                          >
                            Sign In
                          </BaseButton>
                          <BaseButton
                            @click="
                              () => {
                                authMode = 'signup'
                                showAuthForm = true
                              }
                            "
                            variant="outline"
                            size="sm"
                          >
                            Create Account
                          </BaseButton>
                        </div>
                        <div v-if="!hasSubscriptionItems" class="guest-option">
                          <BaseButton @click="showGuestCheckout = true" variant="ghost" size="sm">
                            Continue as Guest
                          </BaseButton>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Guest checkout form (only for non-subscription items) -->
                  <div
                    v-else-if="showGuestCheckout && !hasSubscriptionItems"
                    class="guest-payment-form"
                  >
                    <div class="guest-checkout-header">
                      <div class="guest-checkout-title">
                        <BaseButton @click="showGuestCheckout = false" variant="ghost" size="sm">
                          ← Back to Sign In
                        </BaseButton>
                      </div>
                    </div>
                    <GuestCheckoutForm
                      :requires-shipping="requiresShipping"
                      @form-updated="handleGuestFormUpdated"
                      @payment-method-added="handleGuestPaymentMethodAdded"
                      @ready-state-changed="handleGuestReadyStateChanged"
                    />
                  </div>
                </div>
              </div>

              <!-- Cart Summary -->
            </BaseCard>
          </div>

          <!-- Items List -->
          <div class="cart-items-section">
            <div class="cart-items">
              <div v-for="(item, index) in cartItems" :key="`${item.groupId}:${item.productId}`">
                <div
                  v-if="index === 0 || item.organizationId !== cartItems[index - 1]?.organizationId"
                  class="org-headline"
                >
                  {{ orgHash[item.organizationId]?.name }}
                  <hr />
                </div>
                <div class="cart-item-wrapper">
                  <button
                    class="remove-item-btn"
                    @click="removeItem(index)"
                    title="Remove item from cart"
                  >
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

                  <div v-if="productsLoading" class="loading-state">
                    <LoadingSpinner size="24" />
                  </div>
                  <ProductCard
                    v-else
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
                          :max="getMaxPurchaseQuantity(productHash[`${item.groupId}:${item.productId}`])"
                          v-model.number="item.quantity"
                          size="xs"
                        />
                      </div>
                    </template>
                  </ProductCard>
                </div>
              </div>
            </div>
            <div class="cart-summary">
              <!-- One-time payments -->

              <div v-if="productsLoading" class="loading-state">
                <LoadingSpinner size="24" />
              </div>
              <template v-else-if="Object.keys(subtotalsByTypeAndCurrency.oneTime).length > 0">
                <div class="payment-type-section">
                  <div
                    v-for="(amount, currency) in subtotalsByTypeAndCurrency.oneTime"
                    :key="`oneTime-${currency}`"
                    class="summary-row"
                  >
                    <span class="summary-label">One-time Payments:</span>
                    <span class="summary-value">
                      <PriceDisplay :amount="amount" :currency="currency" size="sm" />
                    </span>
                  </div>
                </div>
              </template>

              <!-- Recurring payments -->
              <template v-if="Object.keys(subtotalsByTypeAndCurrency.recurring).length > 0">
                <div class="payment-type-section">
                  <div
                    v-for="(recurringData, recurringKey) in subtotalsByTypeAndCurrency.recurring"
                    :key="`recurring-${recurringKey}`"
                    class="summary-row"
                  >
                    <span class="summary-label">Recurring Payments:</span>
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

              <!-- Total Due Now -->

              <div v-if="productsLoading" class="loading-state">
                <LoadingSpinner size="24" />
              </div>
              <template v-else-if="Object.keys(totalDueNow).length > 0">
                <div class="summary-row summary-row-top">
                  <span class="summary-label">Subtotal:</span>
                  <span class="summary-value">
                    <div
                      v-for="(amount, currency) in totalDueNow"
                      :key="`total-${currency}`"
                      class="total-amount"
                    >
                      <PriceDisplay :amount="amount" :currency="currency" size="sm" />
                    </div>
                  </span>
                </div>
                <div class="summary-row">
                  <span class="summary-label">Taxes:</span>
                  <span class="summary-value">
                    <div v-if="appStore.taxLoading" class="tax-loading">
                      <LoadingSpinner size="16" />
                    </div>
                    <div v-else-if="Object.keys(taxesByCurrency).length > 0" class="total-amount">
                      <div v-for="(amount, currency) in taxesByCurrency" :key="`tax-${currency}`">
                        <PriceDisplay :amount="amount" :currency="currency" size="sm" />
                      </div>
                    </div>
                    <div v-else class="total-amount">
                      <span class="tax-placeholder">--</span>
                    </div>
                  </span>
                </div>
                <div class="summary-row total">
                  <span class="summary-label">Total:</span>
                  <span class="summary-value">
                    <div
                      v-for="(amount, currency) in totalWithTax"
                      :key="`total-${currency}`"
                      class="total-amount"
                    >
                      <PriceDisplay :amount="amount" :currency="currency" size="sm" />
                    </div>
                  </span>
                </div>
              </template>
            </div>

            <!-- Error Display -->
            <BaseAlert
              v-if="checkoutError"
              variant="error"
              title="Checkout Error"
              :message="checkoutError"
              :show="true"
              dismissible
              @dismiss="checkoutError = null"
            />

            <!-- Checkout Actions -->
            <div class="checkout-actions">
              <BaseButton
                @click="handleCheckout"
                :loading="processingCheckout"
                :disabled="!canProceedToCheckout || processingCheckout"
                variant="primary"
                full-width
                size="lg"
              >
                <template v-if="processingCheckout"> Processing... </template>
                <template v-else-if="!appStore.isAuthenticated && hasSubscriptionItems">
                  Sign In Required
                </template>
                <template v-else> Complete Purchase </template>
              </BaseButton>

              <p class="checkout-disclaimer">
                By completing your purchase, you agree to our terms of service and privacy policy.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Authentication Modal -->
    <BaseModal v-model:show="showAuthForm" size="md" :hide-scrollbar="true">
      <SignIn :initial-mode="authMode" :is-modal="true" @auth-success="handleAuthSuccess" />
    </BaseModal>

    <!-- PaymentIntent Verification Modal (for both guest and authenticated users) -->
    <StripeVerificationModal
      v-if="showPaymentVerificationModal && paymentVerificationClientSecret && stripe"
      :show="showPaymentVerificationModal"
      :client-secret="paymentVerificationClientSecret"
      :stripe="stripe"
      mode="payment"
      title="Verify Your Payment"
      description="Additional verification is required to complete your purchase."
      @verification-success="handlePaymentVerificationSuccess"
      @verification-error="handlePaymentVerificationError"
      @close="handlePaymentVerificationClose"
    />
  </div>
</template>
<script lang="ts" setup>
import {
  authAPI,
  publicApi,
} from '@/services/api'
import { useAppStore } from '@/stores/app'
import { cartService } from '@/utils/cart'
import { poll } from '@/utils/polling'
import { getMaxPurchaseQuantity } from '@/utils/product'
import type { CartItem, Organization, PaymentMethod, Product, TaxCalculationItem } from '@marketplace/types'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import SignIn from './SignIn.vue'
import AddressSearch from './ui/AddressSearch.vue'
import BaseAlert from './ui/BaseAlert.vue'
import BaseButton from './ui/BaseButton.vue'
import BaseCard from './ui/BaseCard.vue'
import BaseModal from './ui/BaseModal.vue'
import GuestCheckoutForm from './ui/GuestCheckoutForm.vue'
import LoadingSpinner from './ui/LoadingSpinner.vue'
import PaymentMethodForm from './ui/PaymentMethodForm.vue'
import PaymentMethodList from './ui/PaymentMethodList.vue'
import PriceDisplay from './ui/PriceDisplay.vue'
import ProductCard from './ui/ProductCard.vue'
import PurchaseCompleteScreen from './ui/PurchaseCompleteScreen.vue'
import QuantitySelector from './ui/QuantitySelector.vue'
import StripeVerificationModal from './ui/StripeVerificationModal.vue'

const route = useRoute()
const appStore = useAppStore()

const error = ref<string | null>(null)
const checkoutError = ref<string | null>(null)
const fieldUpdating = ref<string | null>(null)
const updateError = ref<string | null>(null)
const source = ref<string | null>(null)
const cartItems = ref<CartItem[]>([])
const productHash = ref<Record<string, Product>>({})
const orgHash = ref<Record<string, Organization>>({})
const productsLoading = ref(true)
const processingCheckout = ref(false)
const requiresShipping = ref(false)
const selectedPaymentMethod = ref<PaymentMethod | null>(null)
const showAuthForm = ref(false)
const authMode = ref<'signin' | 'signup'>('signin')
const showGuestCheckout = ref(false)
const guestFormData = ref<{
  firstName: string
  lastName: string
  email: string
  address: {
    line1: string
    line2: string
    city: string
    state: string
    postalCode: string
    country: string
  }
  paymentMethod: PaymentMethod
} | null>(null)
const guestFormReady = ref(false)
const shippingAddress = ref<{
  line1: string
  line2: string
  city: string
  state: string
  postalCode: string
  country: string
} | null>(null)
const userIpAddress = ref<string | null>(null)
const paymentMethodsInitialized = ref(false)
const showPurchaseComplete = ref(false)
const purchaseCompleteMessage = ref('')
const purchaseOrderSummary = ref<{
  totals: Record<string, number>
  hasSubscriptions: boolean
} | undefined>(undefined)

// Payment verification state (used for both guest and authenticated checkouts)
const showPaymentVerificationModal = ref(false)
const paymentVerificationClientSecret = ref<string | null>(null)
const paymentVerificationCartId = ref<string | null>(null)
const paymentVerificationUserId = ref<string | null>(null)
const stripe = ref<Stripe | null>(null)

// Computed properties
const sourceHostname = computed(() => {
  if (!source.value) return null

  try {
    // If source is a full URL, extract hostname
    if (source.value.startsWith('http://') || source.value.startsWith('https://')) {
      const url = new URL(source.value)
      return url.hostname
    }
    // If it's already just a hostname, return as-is
    return source.value
  } catch {
    // Fallback if URL parsing fails
    return source.value
  }
})

const hasSubscriptionItems = computed(() => {
  return cartItems.value.some((item) => {
    const product = productHash.value[`${item.groupId}:${item.productId}`]
    return product?.default_price_data?.recurring
  })
})

const canProceedToCheckout = computed(() => {
  if (appStore.isAuthenticated) {
    return appStore.hasPaymentMethods && selectedPaymentMethod.value
  } else {
    // For guest users, they can't checkout with subscriptions
    if (hasSubscriptionItems.value) {
      return false
    }
    // Guest must have completed form and payment method is ready
    return guestFormData.value && guestFormReady.value
  }
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
      // For metered products, always use quantity of 1
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

        // Create a key that groups by currency, interval, interval_count, and usage_type
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
        // One-time payment
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
      // For metered products, always use quantity of 1
      const effectiveQuantity =
        product.default_price_data.recurring?.usage_type === 'metered' ? 1 : item.quantity
      const amount = product.default_price_data.unit_amount * effectiveQuantity

      // Include one-time payments and licensed subscriptions (charged immediately)
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

const taxesByCurrency = computed(() => {
  const taxes: Record<string, number> = {}

  if (appStore.taxCalculation?.items) {
    cartItems.value.forEach((cartItem) => {
      const product = productHash.value[`${cartItem.groupId}:${cartItem.productId}`]
      if (product?.default_price_data) {
        const currency = product.default_price_data.currency
        // For metered products, always use quantity of 1
        const effectiveQuantity =
          product.default_price_data.recurring?.usage_type === 'metered' ? 1 : cartItem.quantity
        const amount = product.default_price_data.unit_amount * effectiveQuantity

        // Find the tax rate for this item from the tax calculation
        const taxItem = appStore.taxCalculation?.items?.find(
          (item) => item.id === cartItem.productId && item.group_id === cartItem.groupId,
        )

        if (taxItem?.tax_rate) {
          const taxAmount = amount * (taxItem.tax_rate / 100)
          if (!taxes[currency]) {
            taxes[currency] = 0
          }
          taxes[currency] += taxAmount
        }
      }
    })
  }

  return taxes
})

const totalWithTax = computed(() => {
  const totals: Record<string, number> = {}

  // Start with subtotal
  Object.entries(totalDueNow.value).forEach(([currency, amount]) => {
    totals[currency] = amount
  })

  // Add calculated taxes
  Object.entries(taxesByCurrency.value).forEach(([currency, taxAmount]) => {
    if (!totals[currency]) {
      totals[currency] = 0
    }
    totals[currency] += taxAmount
  })

  return totals
})

// Event handlers
const goBack = () => {
  if (source.value) {
    // If source is already a full URL, use it directly
    if (source.value.startsWith('http://') || source.value.startsWith('https://')) {
      window.location.href = source.value
    } else {
      // If it's just a hostname, add https://
      window.location.href = `https://${source.value}`
    }
  } else if (document.referrer && document.referrer !== window.location.href) {
    window.location.href = document.referrer
  } else {
    // Fallback to going back in history
    window.history.back()
  }
}

const removeItem = async (index: number) => {
  const removedItem = cartItems.value[index]
  cartItems.value.splice(index, 1)

  // Update cart service (handles both localStorage and URL)
  try {
    cartService.removeItem(removedItem.groupId, removedItem.productId, removedItem.quantity)

    // Update URL with new cart state
    cartService.updateCartInURL(source.value || undefined)
  } catch (error) {
    console.error('Error updating cart after item removal:', error)
  }

  // Recalculate taxes when items are removed (non-blocking)
  calculateTaxes()
}

const handlePaymentMethodSelected = (paymentMethod: PaymentMethod) => {
  selectedPaymentMethod.value = paymentMethod
}

const handlePaymentMethodAdded = async () => {
  if (appStore.user?.id) {
    await appStore.getPaymentMethods(appStore.user.id)
    paymentMethodsInitialized.value = true
  }
}

async function handleFieldUpdate(
  field: string,
  value: string | { [key: string]: string | undefined },
) {
  if (!appStore.user?.id) {
    return
  }

  fieldUpdating.value = field
  updateError.value = null
  if (field === 'address') {
    if (typeof value === 'object' && value !== null) {
      const addressValue = value as {
        line_1?: string
        line_2?: string
        city?: string
        state?: string
        country?: string
        postal_code?: string
      }
      appStore.user.address = {
        line_1: addressValue.line_1 || '',
        line_2: addressValue.line_2,
        city: addressValue.city || '',
        state: addressValue.state || '',
        country: addressValue.country || '',
        postal_code: addressValue.postal_code || '',
      }
    } else {
      appStore.user.address = parseAddress(value as string)
    }
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(appStore.user as any)[field] = value as string
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let updateData: any = {}
    if (field === 'address') {
      if (typeof value === 'object' && value !== null) {
        updateData = {
          address: value,
        }
      } else {
        updateData = {
          address: parseAddress(value as string),
        }
      }
    } else {
      updateData[field] = value as string
    }

    const result = await appStore.updateUser(updateData)

    if (!result.success) {
      updateError.value = result.error || 'Failed to update field'
    }
  } catch (error) {
    updateError.value = 'Failed to update field'
    console.error('Field update error:', error)
  } finally {
    fieldUpdating.value = null
  }
}

async function handleShippingAddressUpdate(
  field: string,
  value: string | { [key: string]: string | undefined },
) {
  fieldUpdating.value = field
  updateError.value = null

  if (typeof value === 'object' && value !== null) {
    const addressValue = value as {
      line_1?: string
      line_2?: string
      city?: string
      state?: string
      country?: string
      postal_code?: string
    }
    shippingAddress.value = {
      line1: addressValue.line_1 || '',
      line2: addressValue.line_2 || '',
      city: addressValue.city || '',
      state: addressValue.state || '',
      postalCode: addressValue.postal_code || '',
      country: addressValue.country || '',
    }
  } else {
    const parsed = parseAddress(value as string)
    shippingAddress.value = {
      line1: parsed.line_1 || '',
      line2: parsed.line_2 || '',
      city: parsed.city || '',
      state: parsed.state || '',
      postalCode: parsed.postal_code || '',
      country: parsed.country || '',
    }
  }

  fieldUpdating.value = null
}

function formatAddress(address: {
  line_1?: string
  line_2?: string
  city?: string
  state?: string
  country?: string
  postal_code?: string
} | {
  line1?: string
  line2?: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
}) {
  if (!address) return ''

  // Handle both snake_case and camelCase
  const line1 = 'line_1' in address ? address.line_1 : 'line1' in address ? address.line1 : undefined
  const line2 = 'line_2' in address ? address.line_2 : 'line2' in address ? address.line2 : undefined
  const city = address.city
  const state = address.state
  const country = address.country
  const postalCode = 'postal_code' in address ? address.postal_code : 'postalCode' in address ? address.postalCode : undefined

  const parts = [
    line1,
    line2,
    city,
    state,
    country,
    postalCode,
  ].filter(Boolean)
  return parts.join(', ')
}

function parseAddress(addressString: string) {
  const parts = addressString.split(',').map((part) => part.trim())
  return {
    line_1: parts[0] || '',
    line_2: parts[1] || undefined,
    city: parts[2] || '',
    state: parts[3] || '',
    country: parts[4] || '',
    postal_code: parts[5] || '',
  }
}

const handleAuthSuccess = async () => {
  showAuthForm.value = false

  // Ensure we have the latest user data after authentication
  await appStore.fetchCurrentUser()

  // For cart page - aggressively poll for stripe_id creation every second
  if (appStore.user && !appStore.user.stripe_id) {
    const pollForStripeId = async (attempts = 0) => {
      const maxAttempts = 30 // 30 seconds max

      try {
        await appStore.fetchCurrentUser()

        if (appStore.user?.stripe_id) {
          return
        }

        if (attempts < maxAttempts) {
          setTimeout(() => pollForStripeId(attempts + 1), 1000) // Poll every 1 second
        } else {
          console.warn('Stripe customer creation timed out after 30 seconds')
        }
      } catch (error) {
        console.error('Failed to refresh user data:', error)
        if (attempts < maxAttempts) {
          setTimeout(() => pollForStripeId(attempts + 1), 1000)
        }
      }
    }

    // Start polling immediately
    pollForStripeId()
  }

  // Reload payment methods for newly authenticated user
  if (appStore.user?.id) {
    await appStore.getPaymentMethods(appStore.user.id)
    paymentMethodsInitialized.value = true

    // Initialize shipping address with user's address if shipping is required
    if (requiresShipping.value && appStore.user.address) {
      shippingAddress.value = {
        line1: appStore.user.address.line_1 || '',
        line2: appStore.user.address.line_2 || '',
        city: appStore.user.address.city || '',
        state: appStore.user.address.state || '',
        postalCode: appStore.user.address.postal_code || '',
        country: appStore.user.address.country || '',
      }
    }
  }

  // Recalculate taxes with authenticated user data (non-blocking)
  calculateTaxes()
}

const handleGuestFormUpdated = async (formData: {
  firstName: string
  lastName: string
  email: string
  phoneNumber: string
  address: {
    line1: string
    line2: string
    city: string
    state: string
    postal_code: string
    country: string
  }
  shippingAddress?: {
    line1: string
    line2: string
    city: string
    state: string
    postal_code: string
    country: string
  }
}) => {
  // Clear checkout error when user makes changes to form
  checkoutError.value = null

  // Store form data for later use during checkout
  guestFormData.value = {
    firstName: formData.firstName,
    lastName: formData.lastName,
    email: formData.email,
    address: {
      line1: formData.address.line1,
      line2: formData.address.line2,
      city: formData.address.city,
      state: formData.address.state,
      postalCode: formData.address.postal_code,
      country: formData.address.country,
    },
    paymentMethod: guestFormData.value?.paymentMethod || ({} as PaymentMethod),
  }

  // Store shipping address if provided
  if (formData.shippingAddress) {
    shippingAddress.value = {
      line1: formData.shippingAddress.line1,
      line2: formData.shippingAddress.line2,
      city: formData.shippingAddress.city,
      state: formData.shippingAddress.state,
      postalCode: formData.shippingAddress.postal_code,
      country: formData.shippingAddress.country,
    }
  }

  // Recalculate taxes with updated user information (non-blocking)
  calculateTaxes()
}

const handleGuestPaymentMethodAdded = (data: {
  userId: string
  paymentMethodId: string
}) => {
  // Store the userId and paymentMethodId for checkout
  if (!guestFormData.value) {
    checkoutError.value = 'Form data is missing'
    return
  }

  guestFormData.value.paymentMethod = {
    id: data.paymentMethodId,
    user_id: data.userId,
    brand: '', // These will be fetched if needed
    last_four_digits: '',
    expiry_month: 0,
    expiry_year: 0,
  }
}

const handleGuestReadyStateChanged = (isReady: boolean) => {
  guestFormReady.value = isReady
}

const handleCheckout = async () => {
  if (!canProceedToCheckout.value) return

  processingCheckout.value = true
  checkoutError.value = null

  try {
    // Transform cart items to product keys format
    const productKeys: {
      id: string
      group_id: string
    }[] = []
    for (const item of cartItems.value) {
      const product = productHash.value[`${item.groupId}:${item.productId}`]
      // For metered products, always use quantity of 1
      const effectiveQuantity =
        product?.default_price_data?.recurring?.usage_type === 'metered' ? 1 : item.quantity
      for (let i = 0; i < effectiveQuantity; i++) {
        productKeys.push({
          id: item.productId,
          group_id: item.groupId,
        })
      }
    }

    if (appStore.isAuthenticated) {
      // Authenticated user checkout
      if (!selectedPaymentMethod.value) {
        throw new Error('Please select a payment method')
      }

      if (!appStore.user?.id) {
        throw new Error('User not authenticated')
      }

      const purchaseData = {
        userId: appStore.user.id,
        paymentMethodId: selectedPaymentMethod.value.id,
        productKeys,
        // promoCode and couponId can be added later when promo functionality is implemented
        ...(requiresShipping.value ? {
          shippingAddress: {
            full_name: appStore.user.given_name && appStore.user.family_name
              ? `${appStore.user.given_name} ${appStore.user.family_name}`
              : appStore.fullName || '',
            address_line1: shippingAddress.value?.line1 || appStore.user.address?.line_1 || '',
            address_line2: shippingAddress.value?.line2 || appStore.user.address?.line_2,
            city: shippingAddress.value?.city || appStore.user.address?.city || '',
            state: shippingAddress.value?.state || appStore.user.address?.state || '',
            postal_code: shippingAddress.value?.postalCode || appStore.user.address?.postal_code || '',
            country: shippingAddress.value?.country || appStore.user.address?.country || '',
          }
        } : {})
      }

      const response = await authAPI.purchaseProducts(purchaseData)

      // Poll cart status to check for PaymentIntent 3DS requirements
      const purchaseResult = await pollUntilCartReady(
        appStore.user.id,
        response.cartId
      )

      if (!purchaseResult.success) {
        // If there's no error, it means we're waiting for payment verification modal
        // Don't throw - the modal handlers will continue the flow
        if (purchaseResult.error) {
          throw new Error(purchaseResult.error)
        }
        // Modal is open, keep processingCheckout true, exit early
        return
      }

      // Success - show confirmation
      showSuccessMessage(
        'Order processed successfully! You will receive a confirmation email shortly.',
      )
    } else {
      // Guest checkout - payment method is already created and verified
      if (!guestFormData.value || !guestFormData.value.paymentMethod?.id) {
        throw new Error('Please complete the payment form')
      }

      // Step 4: Purchase products using the new API
      const response = await publicApi.publicPurchaseProducts({
        userId: guestFormData.value.paymentMethod.user_id,
        paymentMethodId: guestFormData.value.paymentMethod.id,
        productKeys,
        // promoCode and couponId can be added later when promo functionality is implemented
        ...(requiresShipping.value ? {
          shippingAddress: {
            full_name: `${guestFormData.value.firstName} ${guestFormData.value.lastName}`,
            address_line1: shippingAddress.value?.line1 || guestFormData.value.address.line1,
            address_line2: shippingAddress.value?.line2 || guestFormData.value.address.line2,
            city: shippingAddress.value?.city || guestFormData.value.address.city,
            state: shippingAddress.value?.state || guestFormData.value.address.state,
            postal_code: shippingAddress.value?.postalCode || guestFormData.value.address.postalCode,
            country: shippingAddress.value?.country || guestFormData.value.address.country,
          }
        } : {})
      })

      // Step 4b: Poll cart status to check for PaymentIntent 3DS requirements
      const purchaseResult = await pollUntilCartReady(
        guestFormData.value.paymentMethod.user_id,
        response.cartId
      )

      if (!purchaseResult.success) {
        // If there's no error, it means we're waiting for payment verification modal
        // Don't throw - the modal handlers will continue the flow
        if (purchaseResult.error) {
          throw new Error(purchaseResult.error)
        }
        // Modal is open, keep processingCheckout true, exit early
        return
      }

      // Success - show confirmation
      showSuccessMessage(
        `Order processed successfully! A confirmation has been sent to ${guestFormData.value.email}.`,
      )
    }

    // Clear cart after successful checkout
    cartItems.value = []
    selectedPaymentMethod.value = null
    guestFormData.value = null

    // Clear cart from localStorage and URL
    cartService.clearCart()
    cartService.updateCartInURL(source.value || undefined)
  } catch (err) {
    console.error('Checkout failed:', err)

    // Handle API error responses with structured error messages
    if (err && typeof err === 'object' && 'response' in err && err.response) {
      const response = err.response as { data?: { error?: string }; statusText?: string }
      if (response.data && response.data.error) {
        checkoutError.value = response.data.error
      } else if (response.statusText) {
        checkoutError.value = `Checkout failed: ${response.statusText}`
      } else {
        checkoutError.value = 'Checkout failed. Please try again.'
      }
    } else if (err instanceof Error) {
      checkoutError.value = err.message
    } else {
      checkoutError.value = 'Checkout failed. Please try again.'
    }
  } finally {
    processingCheckout.value = false
  }
}

const pollUntilCartReady = async (
  userId: string,
  cartId: string
): Promise<{ success: boolean; error?: string }> => {
  let waitingForVerification = false

  const result = await poll<{
    success?: boolean;
    cartStatus?: string;
    ready?: boolean;
    requiresAction?: boolean;
    purchases?: Array<{ id: string; status: string; requiresAction?: boolean; clientSecret?: string }>
  }>({
    checkFn: async () => {
      // If we're waiting for verification, don't make another API call
      if (waitingForVerification) {
        return { ready: false }
      }

      const status = await publicApi.publicGetCartStatus(cartId, userId)

      // Check new response format: { success: true, cartStatus: "succeeded" }
      if (status.success && status.cartStatus === 'succeeded') {
        return { ready: true, success: true, cartStatus: 'succeeded' }
      }

      // Check if cart has definitively failed (all purchases failed)
      if (status.success === false && status.cartStatus === 'failed') {
        return { ready: true, success: false, cartStatus: 'failed' }
      }

      // Check if PaymentIntent verification required
      if (status.requiresAction && status.purchases) {
        const purchaseRequiringAction = status.purchases.find((p) => p.requiresAction)

        if (purchaseRequiringAction?.clientSecret) {
          paymentVerificationClientSecret.value = purchaseRequiringAction.clientSecret
          paymentVerificationUserId.value = userId
          paymentVerificationCartId.value = cartId
          showPaymentVerificationModal.value = true
          waitingForVerification = true

          // Return status to pause polling - keep waiting
          return { ready: false, waitingForVerification: true }
        }
      }

      return status
    },
    conditionFn: (status) => {
      // Stop polling if cart succeeded
      if (status.success && status.cartStatus === 'succeeded') {
        return false
      }
      // Stop polling if cart definitively failed
      if (status.success === false && status.cartStatus === 'failed') {
        return false
      }
      // Continue polling if not ready (including when waiting for verification)
      return !status.ready
    },
    maxAttempts: 20,
    initialDelay: 2000,
  })

  // If we're waiting for verification when polling ends, that's not a failure
  // The modal is open and waiting for user action
  if (waitingForVerification) {
    return {
      success: false,
      error: undefined, // No error - modal is handling verification
    }
  }

  if (!result.success) {
    return {
      success: false,
      error:
        'Purchase processing timed out. Please check your email for confirmation or contact support.',
    }
  }

  // Check if polling stopped due to failure
  if (result.data && result.data.success === false && result.data.cartStatus === 'failed') {
    return {
      success: false,
      error: 'All purchases failed. Please check your payment method and try again.',
    }
  }

  return { success: true }
}

const handlePaymentVerificationSuccess = async () => {
  showPaymentVerificationModal.value = false

  // Resume polling after successful PaymentIntent verification
  if (paymentVerificationUserId.value && paymentVerificationCartId.value) {
    const { userId, cartId } = {
      userId: paymentVerificationUserId.value,
      cartId: paymentVerificationCartId.value,
    }

    // Clear verification state
    paymentVerificationClientSecret.value = null
    paymentVerificationUserId.value = null
    paymentVerificationCartId.value = null

    // Continue polling for final purchase completion
    const pollResult = await pollUntilCartReady(userId, cartId)

    if (pollResult.success) {
      // Determine success message based on user type
      const successMessage = appStore.isAuthenticated
        ? 'Order processed successfully! You will receive a confirmation email shortly.'
        : `Order processed successfully! A confirmation has been sent to ${guestFormData.value?.email}.`

      showSuccessMessage(successMessage)

      // Clear cart after successful checkout
      cartItems.value = []
      selectedPaymentMethod.value = null
      guestFormData.value = null

      // Clear cart from localStorage and URL
      cartService.clearCart()
      cartService.updateCartInURL(source.value || undefined)
    } else {
      // Payment failed after verification - show error and keep cart
      checkoutError.value =
        pollResult.error ||
        'Purchase processing failed after verification. Please contact support.'
      processingCheckout.value = false
      return // Exit early, don't reset processing state
    }
  }

  processingCheckout.value = false
}

const handlePaymentVerificationError = (error: string) => {
  showPaymentVerificationModal.value = false
  paymentVerificationClientSecret.value = null
  paymentVerificationUserId.value = null
  paymentVerificationCartId.value = null
  checkoutError.value = `Payment verification failed: ${error}`
  processingCheckout.value = false
}

const handlePaymentVerificationClose = () => {
  showPaymentVerificationModal.value = false
  paymentVerificationClientSecret.value = null
  paymentVerificationUserId.value = null
  paymentVerificationCartId.value = null
  processingCheckout.value = false
}


const showSuccessMessage = (message: string) => {
  // Show purchase complete screen instead of redirecting
  purchaseCompleteMessage.value = message

  // Calculate order summary
  purchaseOrderSummary.value = {
    totals: totalWithTax.value,
    hasSubscriptions: hasSubscriptionItems.value
  }

  showPurchaseComplete.value = true
}

const getUserIpAddress = async () => {
  try {
    const response = await fetch('https://api.ipify.org?format=json')
    const data = await response.json()
    return data.ip
  } catch (error) {
    console.error('Failed to get IP address:', error)
    return null
  }
}

const calculateTaxes = async () => {
  if (cartItems.value.length === 0) return

  const taxItems: TaxCalculationItem[] = cartItems.value.map((item) => {
    const product = productHash.value[`${item.groupId}:${item.productId}`]
    // For metered products, always use quantity of 1
    const effectiveQuantity =
      product?.default_price_data?.recurring?.usage_type === 'metered' ? 1 : item.quantity
    return {
      id: item.productId,
      group_id: item.groupId,
      organization_id: item.organizationId,
      quantity: effectiveQuantity,
    }
  })
  const useUser = appStore.isAuthenticated && appStore.user?.address
  const taxRequest = {
    items: taxItems,
    userId: useUser ? appStore.user?.id : undefined,
    ipAddress: !useUser && userIpAddress.value != null ? userIpAddress.value : undefined,
  }

  await appStore.calculateTaxes(taxRequest)
}

watch(
  () => appStore.paymentMethods,
  (newCards) => {
    // Handle changes to payment cards
    if (newCards.length === 1) {
      handlePaymentMethodSelected(newCards[0])
    }
  },
  {
    deep: true,
    immediate: true,
  },
)

onMounted(async () => {
  try {
    // Initialize Stripe
    const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
    if (stripePublishableKey) {
      stripe.value = await loadStripe(stripePublishableKey)
    }

    // Initialize app store authentication
    await appStore.initializeAuth()

    // Load cart data from URL or localStorage
    const cartString = Array.isArray(route.query.cart) ? route.query.cart[0] : route.query.cart
    const cartData = cartService.loadCartFromURLOrStorage(cartString)

    if (cartData.source) {
      source.value = cartData.source
    }

    // Sort cart items by organization
    cartItems.value = cartData.items.sort((a, b) => {
      const nameA = a.organizationId
      const nameB = b.organizationId
      return nameA.localeCompare(nameB)
    })

    // Update URL with cart data for bookmarking/sharing
    if (cartItems.value.length > 0) {
      cartService.updateCartInURL(source.value || undefined)
    }

    // Fetch product and organization data
    const uniqueOrgIds = new Set<string>()
    const uniqueProductKeys = new Set<string>()
    for (const item of cartItems.value) {
      uniqueOrgIds.add(item.organizationId)
      uniqueProductKeys.add(`${item.groupId}:${item.productId}`)
    }
    const orgPromises: Promise<Organization>[] = []
    uniqueOrgIds.forEach((id) => {
      const org = publicApi.getPublicOrganization(id)
      if (org) orgPromises.push(org)
    })
    const productPromises: Promise<Product | null>[] = []
    uniqueProductKeys.forEach((key) => {
      const [groupId, productId] = key.split(':')
      const prodPromise = publicApi.getPublicProduct(groupId, productId).catch(() => null)
      if (prodPromise) productPromises.push(prodPromise)
    })
    const [orgs, prods] = await Promise.all([
      Promise.allSettled(orgPromises),
      Promise.allSettled(productPromises),
    ])

    // Filter out null products (products that couldn't be fetched)
    const validProducts = prods
      .filter((prod) => prod != null && prod.status === 'fulfilled' && prod.value != null)
      .map((res) => (res as PromiseFulfilledResult<Product>).value)
    const validProductKeys = new Set(validProducts.map((prod) => `${prod.group_id}:${prod.id}`))

    // Remove cart items that have missing products
    const originalCartLength = cartItems.value.length
    cartItems.value = cartItems.value.filter((item) => {
      const itemKey = `${item.groupId}:${item.productId}`
      return validProductKeys.has(itemKey)
    })

    // Update localStorage and URL if items were removed
    if (cartItems.value.length !== originalCartLength) {
      // Sync with cart service
      cartItems.value.forEach((item) => {
        cartService.updateQuantity(item.groupId, item.productId, item.quantity)
      })
      cartService.updateCartInURL(source.value || undefined)
    }

    orgHash.value = orgs.reduce(
      (hash, org) => {
        if (org.status === 'fulfilled') {
          hash[org.value.id] = org.value
        }
        return hash
      },
      {} as Record<string, Organization>,
    )
    productHash.value = validProducts.reduce(
      (hash, prod) => {
        if (prod.metadata?.shipping_required === 'true') {
          requiresShipping.value = true
        }
        hash[`${prod.group_id}:${prod.id}`] = prod
        return hash
      },
      {} as Record<string, Product>,
    )

    // Load payment methods for authenticated users
    if (appStore.isAuthenticated && appStore.user?.id) {
      await appStore.getPaymentMethods(appStore.user.id)
      paymentMethodsInitialized.value = true

      // Initialize shipping address with user's address if shipping is required
      if (requiresShipping.value && appStore.user.address) {
        shippingAddress.value = {
          line1: appStore.user.address.line_1 || '',
          line2: appStore.user.address.line_2 || '',
          city: appStore.user.address.city || '',
          state: appStore.user.address.state || '',
          postalCode: appStore.user.address.postal_code || '',
          country: appStore.user.address.country || '',
        }
      }
    }

    // Get user IP address if not authenticated (non-blocking)
    getUserIpAddress().then(ip => {
      userIpAddress.value = ip
    })

    // Show page immediately, calculate taxes in background
    productsLoading.value = false

    source.value = decodeURIComponent(
      (Array.isArray(route.query.source) ? route.query.source[0] : route.query.source) ?? '',
    )

    // Calculate initial taxes (non-blocking)
    calculateTaxes()
  } catch (err) {
    error.value = `Error loading cart: ${err instanceof Error ? err.message : 'Unknown error'}`
  } finally {
    productsLoading.value = false
  }
})
</script>

<style scoped>
.cart-page {
  min-height: 100dvh;
  background: var(--color-bg-secondary, #f8fafc);
  padding: var(--space-6) 0;
}

.container {
  margin: 0 auto;
  padding: 0 var(--space-4);
}

/* Header */
.cart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2);
  flex-wrap: wrap;
  gap: var(--space-4);
}

.cart-title {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin: 0;
}

.source-badge {
  background: var(--color-primary-bg, rgba(59, 130, 246, 0.1));
  color: var(--color-primary);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  border: 1px solid var(--color-primary-alpha);
  margin-left: auto;
}

/* Loading State */
.loading-state {
  text-align: center;
  padding: var(--space-12);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
}

.loading-text {
  color: var(--color-text-secondary);
  font-size: var(--font-size-lg);
  margin: 0;
}

/* Cart Layout */
.cart-layout {
  display: grid;
  gap: var(--space-8);
}

.cart-content {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: var(--space-8);
  align-items: start;
}

/* Empty Cart */
.empty-cart {
  text-align: center;
  padding: var(--space-16);
  background: var(--color-bg-primary);
  border-radius: var(--radius-lg);
  border: 2px dashed var(--color-border);
}

.empty-icon {
  color: var(--color-text-secondary);
  margin-bottom: var(--space-6);
  opacity: 0.85;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  height: 150px;
  position: relative;
  overflow: visible;
  width: 100%;
}

.empty-icon__scene {
  position: relative;
  width: 100%;
  height: 130px;
  pointer-events: none;
  margin: 0 auto;
}

.empty-icon__ground {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 20px;
  height: 2px;
  background: currentColor;
  opacity: 0.18;
  z-index: 0;
}

.empty-icon__blocker {
  position: absolute;
  bottom: 0;
  width: clamp(64px, 14%, 120px);
  height: 100%;
  background: var(--color-bg-primary);
  z-index: 3;
  pointer-events: none;
  opacity: 0.96;
}

.empty-icon__blocker::after {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0.35;
}

.empty-icon__blocker--left {
  left: 0;
  opacity: 1;
}

.empty-icon__blocker--right {
  right: 0;
  opacity: 1;
}

.empty-icon__cart {
  position: absolute;
  bottom: 20px;
  left: 0;
  width: 64px;
  height: 64px;
  transform-origin: 50% 70%;
  filter: drop-shadow(0 6px 14px rgba(15, 23, 42, 0.22));
  animation: cart-motion 4.6s linear infinite;
  will-change: left, transform;
  z-index: 2;
}

@keyframes cart-motion {
  0% {
    left: 0;
    transform: translateY(0) rotate(-6deg) scale(0.98);
  }

  12% {
    left: calc((100% - 64px) * 0.087);
    transform: translateY(-4px) rotate(-10deg) scale(0.99);
  }

  24% {
    left: calc((100% - 64px) * 0.209);
    transform: translateY(-12px) rotate(-16deg) scale(0.99);
  }

  32% {
    left: calc((100% - 64px) * 0.313);
    transform: translateY(-26px) rotate(-18deg) scale(1);
  }

  42% {
    left: calc((100% - 64px) * 0.457);
    transform: translateY(-56px) rotate(-12deg) scale(1.01);
  }

  52% {
    left: calc((100% - 64px) * 0.6);
    transform: translateY(-82px) rotate(-2deg) scale(1.02);
  }

  60% {
    left: calc((100% - 64px) * 0.696);
    transform: translateY(-94px) rotate(6deg) scale(1.02);
  }

  70% {
    left: calc((100% - 64px) * 0.783);
    transform: translateY(-64px) rotate(10deg) scale(1.01);
  }

  80% {
    left: calc((100% - 64px) * 0.861);
    transform: translateY(-28px) rotate(6deg) scale(1);
  }

  88% {
    left: calc((100% - 64px) * 0.913);
    transform: translateY(-6px) rotate(2deg) scale(0.99);
  }

  100% {
    left: calc(100% - 64px);
    transform: translateY(0) rotate(-4deg) scale(0.98);
  }
}

.empty-cart h2 {
  font-size: var(--font-size-xl);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-3) 0;
}

.empty-cart p {
  color: var(--color-text-secondary);
  font-size: var(--font-size-base);
  margin: 0 0 var(--space-6) 0;
}

.back-to-products-btn {
  margin-top: var(--space-4);
}

/* Cart Items Section */
.cart-items-section {
  background: var(--color-bg-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  border: 1px solid var(--color-border);
}

.section-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-6) 0;
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}

.cart-items {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.cart-items > div {
  flex: none;
}

/* Override BaseCard behavior for compact ProductCards */
.cart-items .product-card--compact {
  height: auto !important;
  flex: none !important;
}

.cart-item {
  background: var(--color-bg-secondary, #f8fafc);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-6);
  transition: all 0.2s ease;
}

.cart-item:hover {
  border-color: var(--color-primary-alpha);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.cart-item-wrapper {
  position: relative;
  display: flex;
  justify-content: center;
  width: 100%;
}

.remove-item-btn {
  position: absolute;
  top: -16px;
  left: calc(50% - 160px);
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
  pointer-events: all;
}

.cart-item-wrapper:hover .remove-item-btn {
  opacity: 1;
  transform: scale(1);
}

.remove-item-btn:hover {
  background: rgba(220, 38, 38, 1);
  color: white;
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.remove-item-btn:active {
  transform: scale(0.95);
}

.quantity-container {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: right;
}

/* Checkout Section */
.checkout-section {
  position: sticky;
  overflow: visible;
}

.checkout-card {
  overflow: visible;
}

.auth-status {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-6);
}

.auth-status.authenticated {
  background: var(--color-success-bg, rgba(34, 197, 94, 0.1));
  border: 1px solid var(--color-success-alpha);
}

.auth-status.anonymous {
  background: var(--color-info-bg, rgba(59, 130, 246, 0.1));
  border: 1px solid var(--color-primary-alpha);
}

.auth-icon {
  flex-shrink: 0;
}

.auth-status.authenticated .auth-icon {
  color: var(--color-success);
}

.auth-status.anonymous .auth-icon {
  color: var(--color-primary);
}

.auth-info {
  flex: 1;
}

.auth-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0 0 var(--space-1) 0;
  font-weight: var(--font-weight-medium);
}

.auth-name {
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  margin: 0;
  font-weight: var(--font-weight-semibold);
}

.auth-description {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
}

/* Payment Section */
.payment-section {
  margin-bottom: var(--space-6);
  overflow: visible;
}

.payment-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-8);
  text-align: center;
}

.loading-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
}

.payment-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-4) 0;
}

.existing-payment,
.add-payment-method,
.guest-payment-form {
  border-radius: var(--radius-md);
  overflow: visible;
}

/* Cart Summary */
.cart-summary {
  background: var(--color-bg-secondary, #f8fafc);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  margin-bottom: var(--space-6);
  margin-top: var(--space-6);
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) 0;
}

.summary-row.total {
  border-top: 1px solid var(--color-border);
  margin-top: var(--space-2);
  padding-top: var(--space-3);
  font-weight: var(--font-weight-semibold);
}

.summary-label {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.summary-value {
  margin-left: auto;
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
}

.total-amount {
  display: flex;
  justify-content: flex-end;
}

/* Checkout Actions */
.checkout-actions {
  padding-top: var(--space-6);
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.checkout-disclaimer {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  text-align: center;
  margin: 0;
  line-height: 1.4;
}

/* Responsive Design */
@media (max-width: 1024px) {
  .cart-content {
    grid-template-columns: 1fr;
    gap: var(--space-6);
  }

  .checkout-section {
    position: static;
  }
}

@media (max-width: 640px) {
  .container {
    padding: 0 var(--space-3);
  }

  .cart-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
  }

  .cart-title {
    font-size: var(--font-size-2xl);
  }

  .cart-items-section {
    padding: var(--space-4);
  }

  .item-header {
    flex-direction: column;
    gap: var(--space-3);
  }

  .item-quantity {
    align-self: flex-start;
  }

  .detail-item {
    flex-direction: column;
    gap: var(--space-1);
  }

  .detail-label {
    min-width: auto;
    font-size: var(--font-size-xs);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .empty-cart {
    padding: var(--space-8);
  }

  .empty-icon {
    height: 120px;
  }

  .empty-icon__scene {
    width: 180px;
    height: 120px;
  }

  .loading-state {
    padding: var(--space-8);
  }
}
.summary-row-top {
  border-top: 1px solid var(--color-border);
  margin-bottom: var(--space-2);
}

.tax-loading {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.tax-placeholder {
  color: var(--color-text-secondary);
  font-style: italic;
}

.org-headline {
  margin-bottom: var(--space-4);
}

/* Default Auth Section */
.default-auth-section {
  margin-bottom: var(--space-6);
}

.auth-prompt {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  border-radius: var(--radius-md);
}

.auth-icon.primary {
  color: var(--color-primary);
  flex-shrink: 0;
  margin-top: var(--space-1);
}

/* Auth Required Notice */
.auth-required-notice {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  padding: var(--space-6);
  background: var(--color-warning-bg, rgba(245, 158, 11, 0.1));
  border: 1px solid var(--color-warning-alpha, rgba(245, 158, 11, 0.2));
  border-radius: var(--radius-md);
  margin-bottom: var(--space-6);
}

.auth-icon.warning {
  color: var(--color-warning, #f59e0b);
  flex-shrink: 0;
  margin-top: var(--space-1);
}

.auth-message {
  width: 100%;
}

.auth-message h3 {
  margin: 0 0 var(--space-2) 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.auth-message p {
  margin: 0 0 var(--space-4) 0;
  color: var(--color-text-secondary);
  line-height: var(--line-height-relaxed);
}

.auth-actions {
  display: flex;
  gap: var(--space-3);
}

/* Guest Checkout Header */
.guest-checkout-header {
  margin-bottom: var(--space-4);
}

.guest-checkout-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.guest-checkout-title h4 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.auth-link {
  background: none;
  border: none;
  color: var(--color-primary);
  text-decoration: underline;
  cursor: pointer;
  font-size: inherit;
  padding: 0;
  margin: 0;
}

.auth-link:hover {
  color: var(--color-primary-hover);
}

/* Guest Option */
.guest-option {
  margin-top: var(--space-4);
  text-align: right;
  width: 100%;
}

@media (prefers-reduced-motion: reduce) {
  .empty-icon__cart {
    left: calc(50% - 32px);
    transform: translateY(0) rotate(-4deg) scale(1);
  }
}
.address-search {
  margin-bottom: var(--space-4);
}
</style>
