<template>
  <div class="dashboard-page">
    <!-- Logout Splash Screen -->
    <div v-if="isLoggingOut" class="logout-splash">
      <LoadingSpinner :size="64" />
      <p class="logout-text">Logging out...</p>
    </div>

    <header class="dashboard-header" aria-label="Dashboard header">
      <BaseButton variant="ghost" size="sm" @click="goToMarketplace" class="back-button">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </BaseButton>
      <h1 class="dashboard-title"></h1>
      <div class="dashboard-actions">
        <div class="theme-toggle"><ThemeToggle /></div>
        <BaseButton variant="outline" size="sm" :loading="isLoggingOut" @click="handleLogout">
          Logout
        </BaseButton>
      </div>
    </header>
    <main class="dashboard-main">
      <div class="dashboard-grid">
        <BaseCard class="profile-card" title="Profile">
          <div class="profile-info">
            <div class="row">
              <EditableField
                label="First Name"
                :value="app.user?.given_name || ''"
                field="given_name"
                @update="handleFieldUpdate"
                :loading="fieldUpdating === 'given_name'"
              />
              <EditableField
                label="Last Name"
                :value="app.user?.family_name || ''"
                field="family_name"
                @update="handleFieldUpdate"
                :loading="fieldUpdating === 'family_name'"
              />
            </div>
            <EditableField
              label="Phone"
              :value="app.user?.phone_number || ''"
              field="phone_number"
              @update="handleFieldUpdate"
              :loading="fieldUpdating === 'phone_number'"
            />
            <AddressSearch
              label="Address"
              :value="formatAddress(app.user?.address ?? {}) || ''"
              field="address"
              @update="handleFieldUpdate"
              :loading="fieldUpdating === 'address'"
            />
          </div>
        </BaseCard>
        <BaseCard
          class="notification-card"
          title="Notifications"
          :expandable="true"
          :badge="app.unreadNotificationCount > 0 ? app.unreadNotificationCount : undefined"
          ref="notificationCard"
        >
          <template #default="{ expanded }">
            <NotificationManager :expanded="expanded" />
          </template>
        </BaseCard>
        <BaseCard class="payment-card" title="Payment Methods">
          <div class="payment-methods-section">
            <PaymentMethodList
              :payment-methods="paymentMethods"
              @archive-payment-method="handleArchivePaymentMethod"
            />
            <PaymentMethodForm
              :key="`payment-form-${paymentMethods.length}`"
              :has-existing-payment-method="paymentMethods.length > 0"
              @payment-method-added="handlePaymentMethodAdded"
            />
          </div>
        </BaseCard>
        <BaseCard
          class="seller-management-card"
          title="Seller Setup"
          :expandable="true"
          ref="sellerManagerCard"
        >
          <template #default="{ expanded }">
            <SellerManager :expanded="expanded" @get-started="handleGetStarted" />
          </template>
        </BaseCard>
        <BaseCard
          v-if="products.length > 0 && paymentMethods.length > 0"
          title="Products For You"
          class="product-card"
        >
          <div class="product-list">
            <ProductsList :products="products" @purchase-success="handlePurchaseSuccess" />
          </div>
        </BaseCard>

        <BaseCard
          v-if="canCreateProducts"
          class="product-card"
          title="Manage Products"
          :expandable="true"
          ref="vendorProductsCard"
        >
          <template #default="{ expanded }">
            <VendorProducts
              :expanded="expanded"
              @edit="handleVendorProductEdit"
              @close="handleVendorProductClose"
            />
          </template>
        </BaseCard>

        <BaseCard v-if="app.hasPurchased" title="Your Purchases" class="purchases-card">
          <InfinitePurchasesList :viewer-type="'purchaser'" :limit="10" />
        </BaseCard>

        <BaseCard v-if="canCreateProducts" title="Your Sales" class="purchases-card">
          <InfinitePurchasesList :viewer-type="'seller'" :limit="10" />
        </BaseCard>

        <BaseCard
          v-if="app.hasSubscription"
          class="subscription-card"
          title="Subscription"
          ref="subscriptionCard"
          :expandable="true"
        >
          <template #default="{ expanded }">
            <SubscriptionManager :expanded="expanded" @expand="handleSubscriptionExpanded" />
          </template>
        </BaseCard>
      </div>
    </main>

    <!-- Change Password Modal Placeholder -->
    <BaseAlert
      v-if="passwordChangeSuccess"
      variant="success"
      title="Success"
      message="Your password has been changed successfully."
      :show="passwordChangeSuccess"
      dismissible
      @dismiss="passwordChangeSuccess = false"
      class="success-alert"
    />

    <!-- Update Error Alert -->
    <BaseAlert
      v-if="updateError"
      variant="error"
      title="Update Failed"
      :message="updateError"
      :show="!!updateError"
      dismissible
      @dismiss="updateError = null"
      class="error-alert"
    />

    <!-- Header actions replace floating action button -->
  </div>
</template>

<script setup lang="ts">
import AddressSearch from '@/components/ui/AddressSearch.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import EditableField from '@/components/ui/EditableField.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import NotificationManager from '@/components/ui/NotificationManager.vue'
import PaymentMethodForm from '@/components/ui/PaymentMethodForm.vue'
import PaymentMethodList from '@/components/ui/PaymentMethodList.vue'
import ProductsList from '@/components/ui/ProductsList.vue'
import SellerManager from '@/components/ui/SellerManager.vue'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'
import { useAppStore } from '@/stores/app'
import type { PaymentMethod, Product } from '@marketplace/types'
import { onMounted, provide, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import InfinitePurchasesList from './ui/InfinitePurchasesList.vue'
import SubscriptionManager from './ui/SubscriptionManager.vue'
import VendorProducts from './ui/VendorProducts.vue'

const app = useAppStore()
const router = useRouter()
const isRefreshing = ref(false)
const passwordChangeSuccess = ref(false)
const fieldUpdating = ref<string | null>(null)
const updateError = ref<string | null>(null)
const paymentMethods = ref<PaymentMethod[]>([])
const products = ref<Product[]>([])
const fullscreenCard = ref<HTMLElement | null>(null)
const paymentMethodsLoading = ref(true)
const orgLoading = ref(true)
const canCreateProducts = ref(false)
const vendorProductsCard = ref<InstanceType<typeof BaseCard>>()
const sellerManagerCard = ref<InstanceType<typeof BaseCard>>()
const subscriptionCard = ref<InstanceType<typeof BaseCard>>()
const notificationCard = ref<InstanceType<typeof BaseCard>>()
const isLoggingOut = ref(false)

const allowedFields = ['given_name', 'family_name', 'name', 'phone_number', 'address']

async function handleLogout() {
  isLoggingOut.value = true
  await app.logout()
  router.push('/auth')
}

function goToMarketplace() {
  router.push('/marketplace')
}

async function refreshProfile() {
  isRefreshing.value = true
  await app.fetchCurrentUser()
  await app.fetchOrganization()
  isRefreshing.value = false
}

async function fetchProducts() {
  try {
    const groupIds = ['standard']
    if (app.user?.product_groups) {
      groupIds.push(...app.user.product_groups)
    }
    if (app.user?.email) {
      groupIds.push(app.user.email)
    }
    const organizationId = app.user?.organization_id
    if (organizationId) {
      groupIds.push(organizationId)
    }

    const promises = groupIds.map((groupId) => app.getProducts(groupId))
    const productGroups = await Promise.all(promises)

    // Collect all valid products from all groups
    const allProducts: Product[] = []
    for (const productResponse of productGroups) {
      if (productResponse && productResponse.length > 0) {
        allProducts.push(...productResponse)
      }
    }

    // If no products found, set empty array and return
    if (allProducts.length === 0) {
      products.value = []
      return
    }

    const userEmail = app.user?.email ?? ''

    // Remove duplicates based on id and group_id combination, then sort
    const uniqueProducts = allProducts.filter(
      (product, index, self) =>
        index === self.findIndex((p) => p.id === product.id && p.group_id === product.group_id),
    )

    products.value = uniqueProducts.sort((a, b) => {
      if (a.group_id === userEmail && b.group_id !== userEmail) {
        return -1
      }
      if (a.group_id !== userEmail && b.group_id === userEmail) {
        return 1
      }
      if (
        a.metadata?.sort &&
        b.metadata?.sort &&
        !isNaN(Number(a.metadata?.sort)) &&
        !isNaN(Number(b.metadata?.sort)) &&
        a.metadata.sort !== b.metadata.sort
      ) {
        return Number(a.metadata.sort) - Number(b.metadata.sort)
      }
      return a.name.localeCompare(b.name)
    })
  } catch (error) {
    console.error('Error fetching products:', error)
    products.value = []
  }
}

async function fetchPaymentMethods() {
  const userId = app.user?.id
  if (!userId) return

  const paymentMethodsResponse = await app.getPaymentMethods(userId)
  if (paymentMethodsResponse) {
    paymentMethods.value = paymentMethodsResponse
  }
}

async function handlePurchaseSuccess() {
  await app.getUserPurchases()

  await app.fetchOrganization()
}

function formatAddress(address: {
  line_1?: string
  line_2?: string
  city?: string
  state?: string
  country?: string
  postal_code?: string
}) {
  if (!address) return ''
  const parts = [
    address.line_1,
    address.line_2,
    address.city,
    address.state,
    address.country,
    address.postal_code,
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

async function handleFieldUpdate(
  field: string,
  value: string | { [key: string]: string | undefined },
) {
  if (!allowedFields.includes(field) || !app.user?.id) {
    return
  }

  fieldUpdating.value = field
  updateError.value = null

  // Optimistically update local user object
  if (field === 'name') {
    const nameParts = (value as string).trim().split(' ')
    app.user.given_name = nameParts[0] || ''
    app.user.family_name = nameParts.slice(1).join(' ') || ''
    app.user.name = value as string
  } else if (field === 'address') {
    if (typeof value === 'object' && value !== null) {
      const addressValue = value as {
        line_1?: string
        line_2?: string
        city?: string
        state?: string
        country?: string
        postal_code?: string
      }
      app.user.address = {
        line_1: addressValue.line_1 || '',
        line_2: addressValue.line_2,
        city: addressValue.city || '',
        state: addressValue.state || '',
        country: addressValue.country || '',
        postal_code: addressValue.postal_code || '',
      }
    } else {
      app.user.address = parseAddress(value as string)
    }
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(app.user as any)[field] = value as string
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let updateData: any = {}

    if (field === 'name') {
      const nameParts = (value as string).trim().split(' ')
      updateData = {
        given_name: nameParts[0] || '',
        family_name: nameParts.slice(1).join(' ') || '',
        name: value as string,
      }
    } else if (field === 'address') {
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

    const result = await app.updateUser(updateData)

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

function handlePaymentMethodAdded() {
  // Refresh user data to get updated payment methods
  refreshProfile()
  fetchPaymentMethods()
  fetchProducts()
}

async function handleArchivePaymentMethod(paymentMethodId: string) {
  // Remove the payment method from the local array first
  paymentMethods.value = paymentMethods.value.filter((pm) => pm.id !== paymentMethodId)

  // Refresh user data to ensure consistency
  try {
    await refreshProfile()
    await fetchPaymentMethods()

    // Small delay to ensure component has time to remount properly
    await new Promise((resolve) => setTimeout(resolve, 100))
  } catch (error) {
    updateError.value = 'Failed to refresh payment methods'
    console.error('Error refreshing after archive:', error)
  }
}

function setFullscreenCard(cardElement: HTMLElement | null) {
  fullscreenCard.value = cardElement
}

function handleVendorProductEdit() {
  vendorProductsCard.value?.toggleExpanded()
}

function handleVendorProductClose() {
  vendorProductsCard.value?.toggleExpanded()
}

function handleGetStarted() {
  sellerManagerCard.value?.toggleExpanded()
}

function handleSubscriptionExpanded() {
  subscriptionCard.value?.toggleExpanded()
}

// Watch for organization changes and update card visibility
watch(
  () => app.organization,
  (newOrg) => {
    if (newOrg) {
      // Update seller toggle based on Stripe account

      // Update product creation capability based on onboarding status
      canCreateProducts.value = newOrg.onboarding_status === 'completed'
    }
  },
  { deep: true },
)

// Provide the fullscreen functionality to child components
provide('setFullscreenCard', setFullscreenCard)

onMounted(async () => {
  // Ensure we have fresh user data
  if (app.isAuthenticated && !app.user) {
    await app.fetchCurrentUser()
  }
  if (app.isAuthenticated && app.user) {
    app.getUserPurchases()
    fetchPaymentMethods().then(() => {
      // Set initial toggle states based on existing data
      // Customer toggle is on if there are payment methods
      paymentMethodsLoading.value = false
    })
    fetchProducts()
    app.fetchOrganization().then(() => {
      // Set initial toggle states based on existing data
      // Customer toggle is on if there are payment methods
      orgLoading.value = false
      if (app.organization?.onboarding_status === 'completed') {
        canCreateProducts.value = true
      }
      app.getSellerOrganizationPurchases()
    })
  }
})
</script>

<style scoped>
.row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  width: 100%;
  margin: 0;
  padding: 0;
  gap: var(--space-4);
}

.row > * {
  flex: 1;
}

.address-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.field-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-1);
}
.dashboard-page {
  min-height: 100vh;
  background: var(--color-bg-secondary);
  position: relative;
}

/* Header actions (replaces legacy FAB) */
.dashboard-header {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-4) var(--space-2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.back-button {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.back-button svg {
  flex-shrink: 0;
}

.dashboard-title {
  margin: 0;
  font-size: var(--font-size-2xl);
  line-height: var(--line-height-tight);
  color: var(--color-text-primary);
  flex: 1;
}

.dashboard-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.theme-toggle :deep(*) {
  display: inline-flex;
}

/* Hide legacy FAB UI */
.fab-container {
  display: none;
}

.dashboard-main {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-8) var(--space-4);
}

.dashboard-grid {
  column-count: 2;
  column-gap: var(--space-6);
}

.dashboard-grid > .profile-card,
.dashboard-grid > .notification-card,
.dashboard-grid > .payment-card,
.dashboard-grid > .product-card,
.dashboard-grid > .seller-management-card,
.dashboard-grid > .purchases-card {
  display: block;
  break-inside: avoid;
  margin-bottom: var(--space-6);
}

.overview-card {
  grid-column: 1 / -1;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-4);
}

.stat-item {
  text-align: center;
  padding: var(--space-4);
  background: var(--color-bg-muted);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.stat-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-2);
}

.stat-value {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.status-active {
  color: var(--color-success);
}

.action-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.profile-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.notification-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-border);
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.info-value {
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  text-align: right;
  word-break: break-word;
}

.payment-methods-section {
  display: flex;
  flex-direction: column;
}

.payment-form-separator {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: var(--space-2) 0;
}

.separator-line {
  flex: 1;
  height: 1px;
  border: none;
  background: var(--color-border);
  margin: 0;
}

.separator-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  padding: 0 var(--space-2);
}

.success-alert,
.error-alert {
  position: fixed;
  top: var(--space-4);
  right: var(--space-4);
  z-index: var(--z-tooltip);
  max-width: 400px;
  animation: slideInRight 0.3s ease-out;
}

.error-alert {
  top: var(--space-16);
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* Floating Action Button Styles */
.fab-container {
  position: fixed;
  bottom: var(--space-6);
  right: var(--space-6);
  z-index: var(--z-modal);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-3);
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.fab-button {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-full);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: var(--shadow-lg);
  transition: all 0.3s ease;
  position: relative;
}

.fab-primary {
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.fab-primary:hover {
  background: var(--color-bg-muted);
  transform: scale(1.05);
}

.fab-primary img {
  transition: transform 0.3s ease;
}

.fab-primary.active img {
  transform: rotate(90deg);
}

/* Light mode - show full color SVG */
.fab-primary img[src] {
  opacity: 1;
  position: relative;
  z-index: 1;
}

[data-theme='dark'] .fab-primary img[src] {
  opacity: 0;
}

[data-theme='dark'] .fab-primary::after {
  content: '';
  position: absolute;
  width: 32px;
  height: 32px;
  background-color: var(--color-text-primary);
  -webkit-mask: url('/direct-market.svg') no-repeat center / contain;
  mask: url('/direct-market.svg') no-repeat center / contain;
  transition: transform 0.3s ease;
}

[data-theme='dark'] .fab-primary.active::after {
  transform: rotate(90deg);
}

.fab-secondary {
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  width: 48px;
  height: 48px;
  overflow: hidden;
}

.fab-secondary:hover {
  background: var(--color-bg-muted);
  transform: scale(1.05);
}

.fab-secondary :deep(*) {
  max-width: 100%;
  max-height: 100%;
}

.fab-secondary img {
  transition: all 0.3s ease;
}

.fab-menu {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  opacity: 0;
  visibility: hidden;
  transform: translateY(20px);
  transition: all 0.3s ease;
}

.fab-menu.active {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.fab-icon {
  transition: transform 0.3s ease;
}

.fab-hidden {
  opacity: 0 !important;
  transform: translateY(20px) scale(0.8) !important;
  pointer-events: none !important;
}

.subscription-badge {
  border: 1px solid var(--color-border);
  border-color: rgba(34, 197, 94, 0.6);
  box-shadow: 0 12px 35px rgba(34, 197, 94, 0.25);
  border-radius: var(--radius-full);
  padding: 2px 6px 2px 6px;
  max-width: fit-content;
  font-size: x-small;
}
.subscription-info {
  position: relative;
}
.badge-position {
  /* top right of parent div */
  position: absolute;
  top: 8px;
  right: 8px;
}

/* Logout Splash Screen */
.logout-splash {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: var(--color-bg-primary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  z-index: 9999;
  animation: fadeIn 0.2s ease-in;
}

.logout-text {
  font-size: var(--font-size-lg);
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
  margin: 0;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Responsive design */
@media (max-width: 768px) {
  .dashboard-header {
    padding: var(--space-4) var(--space-3) var(--space-1);
    flex-wrap: wrap;
  }

  .back-button {
    order: 1;
  }

  .dashboard-actions {
    order: 2;
    margin-left: auto;
  }

  .dashboard-title {
    order: 3;
    flex-basis: 100%;
  }

  .dashboard-grid {
    column-count: 1;
  }

  .overview-card {
    grid-column: auto;
  }

  .stat-grid {
    grid-template-columns: 1fr;
  }

  .info-row {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-1);
  }

  .info-value {
    text-align: left;
  }

  .fab-container {
    display: none;
  }
}

@media (max-width: 640px) {
  .dashboard-main {
    padding: var(--space-4) var(--space-2);
  }

  .dashboard-grid {
    gap: var(--space-4);
  }

  .success-alert,
  .error-alert {
    top: var(--space-2);
    right: var(--space-2);
    left: var(--space-2);
    max-width: none;
  }

  .error-alert {
    top: var(--space-12);
  }

  .fab-container {
    display: none;
  }
}
</style>
