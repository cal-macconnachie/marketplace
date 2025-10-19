<template>
  <div class="dashboard-page">
    <!-- Logout Splash Screen -->
    <div v-if="isLoggingOut" class="logout-splash">
      <LoadingSpinner :size="64" />
      <p class="logout-text">Logging out...</p>
    </div>

    <main class="dashboard-main">
      <BaseTabs v-model="activeTab" variant="sidebar" aria-label="Dashboard navigation">
        <template #sidebar-header="{ isExpanded }">
          <button class="sidebar-action" @click="goToMarketplace" :title="isExpanded ? '' : 'Back to Marketplace'">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span v-if="isExpanded" class="sidebar-action-label">Back</span>
          </button>

          <div v-if="app.user" class="sidebar-profile" :title="isExpanded ? '' : app.user.email">
            <UserAvatar
              :given-name="app.user.given_name"
              :family-name="app.user.family_name"
              size="sm"
              @click="() => {}"
            />
            <div v-if="isExpanded" class="profile-info">
              <span class="profile-name">{{ app.user.given_name || app.user.email }}</span>
              <span class="profile-email">{{ app.user.email }}</span>
            </div>
          </div>
        </template>

        <template #sidebar-footer="{ isExpanded }">
          <button class="sidebar-action sidebar-action--danger" @click="handleLogout" :disabled="isLoggingOut" :title="isExpanded ? '' : 'Logout'">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span v-if="isExpanded" class="sidebar-action-label">Logout</span>
          </button>
        </template>

        <!-- Profile Tab -->
        <BaseTab
          id="profile"
          label="Profile"
          :icon="profileIcon"
        >
          <ProfileTab v-model:update-error="updateError" />
        </BaseTab>

        <!-- Buying Tab -->
        <BaseTab
          id="buying"
          label="Buying"
          :icon="buyingIcon"
        >
          <BuyingTab />
        </BaseTab>

        <!-- Selling Tab (only show if user has organization) -->
        <BaseTab
          v-if="app.user?.organization_id"
          id="selling"
          label="Selling"
          :icon="sellingIcon"
        >
          <SellingTab />
        </BaseTab>

        <!-- Settings Tab -->
        <BaseTab
          id="settings"
          label="Settings"
          :icon="settingsIcon"
        >
          <SettingsTab />
        </BaseTab>
      </BaseTabs>
    </main>

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
  </div>
</template>

<script setup lang="ts">
import BuyingTab from '@/components/dashboard/BuyingTab.vue'
import ProfileTab from '@/components/dashboard/ProfileTab.vue'
import SellingTab from '@/components/dashboard/SellingTab.vue'
import SettingsTab from '@/components/dashboard/SettingsTab.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseTab from '@/components/ui/BaseTab.vue'
import BaseTabs from '@/components/ui/BaseTabs.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import { useAppStore } from '@/stores/app'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const app = useAppStore()
const router = useRouter()
const isLoggingOut = ref(false)
const updateError = ref<string | null>(null)
const activeTab = ref('profile')

// Tab icons
const profileIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
  <circle cx="12" cy="7" r="4"></circle>
</svg>`

const buyingIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <circle cx="9" cy="21" r="1"></circle>
  <circle cx="20" cy="21" r="1"></circle>
  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
</svg>`

const sellingIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
</svg>`

const settingsIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
  <circle cx="12" cy="12" r="3"></circle>
</svg>`

async function handleLogout() {
  isLoggingOut.value = true
  await app.logout()
  router.push('/')
}

function goToMarketplace() {
  router.push('/')
}

onMounted(async () => {
  // Ensure we have fresh user data
  if (app.isAuthenticated && !app.user) {
    await app.fetchCurrentUser()
  }
})
</script>

<style scoped>
.dashboard-page {
  min-height: 100vh;
  background: var(--color-bg-secondary);
  position: relative;
  width: 100%;
  box-sizing: border-box;
}

/* Main content */
.dashboard-main {
  margin: 0 auto;
  min-height: 100vh;
}

/* Sidebar header - prevent gap changes */
.sidebar-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-3); /* Fixed gap */
}

/* Sidebar Actions */
.sidebar-action {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: var(--space-3);
  padding: var(--space-3);
  background: none;
  border: none;
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--transition-fast);
  text-align: left;
  width: 100%;
  min-height: 44px;
}

.tabs-sidebar:not(.tabs-sidebar--expanded) .sidebar-action {
  justify-content: center;
}

.sidebar-action:hover:not(:disabled) {
  color: var(--color-text-primary);
  background: var(--color-bg-muted);
}

.sidebar-action:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.sidebar-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sidebar-action--danger:hover:not(:disabled) {
  color: var(--color-error);
  background: var(--color-error-bg, rgba(239, 68, 68, 0.1));
}

.sidebar-action svg {
  flex-shrink: 0;
}

.sidebar-action-label {
  flex: 1;
  line-height: 1;
}

/* Sidebar Profile */
.sidebar-profile {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  transition: background var(--transition-fast);
  cursor: default;
  height: 56px; /* Fixed height to prevent layout shift */
  min-height: 56px;
}

.tabs-sidebar:not(.tabs-sidebar--expanded) .sidebar-profile {
  justify-content: center;
  padding: var(--space-3); /* Keep same padding when collapsed */
}

.profile-info {
  display: flex;
  flex-direction: column;
  justify-content: center; /* Center content vertically within fixed height */
  gap: var(--space-1);
  min-width: 0;
  flex: 1;
  overflow: hidden; /* Prevent overflow from breaking layout */
}

.profile-name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.profile-email {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

/* Error Alert */
.error-alert {
  position: fixed;
  top: var(--space-4);
  right: var(--space-4);
  z-index: var(--z-tooltip);
  max-width: 400px;
  animation: slideInRight 0.3s ease-out;
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

/* Responsive design */
@media (max-width: 768px) {
  /* Hide avatar on mobile */
  .sidebar-profile {
    display: none !important;
  }

  /* Align sidebar actions to start on mobile */
  .sidebar-action {
    justify-content: flex-start !important;
  }
}

@media (max-width: 640px) {
  .error-alert {
    top: var(--space-2);
    right: var(--space-2);
    left: var(--space-2);
    max-width: none;
  }
}
</style>
