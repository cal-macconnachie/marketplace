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
      <h1 class="dashboard-title">Dashboard</h1>
      <div class="dashboard-actions">
        <BaseButton variant="outline" size="sm" :loading="isLoggingOut" @click="handleLogout">
          Logout
        </BaseButton>
      </div>
    </header>

    <main class="dashboard-main">
      <BaseTabs v-model="activeTab" aria-label="Dashboard navigation">
        <!-- Profile Tab -->
        <BaseTab id="profile" label="Profile">
          <ProfileTab v-model:update-error="updateError" />
        </BaseTab>

        <!-- Buying Tab -->
        <BaseTab id="buying" label="Buying">
          <BuyingTab />
        </BaseTab>

        <!-- Selling Tab (only show if user has organization) -->
        <BaseTab v-if="app.user?.organization_id" id="selling" label="Selling">
          <SellingTab />
        </BaseTab>

        <!-- Settings Tab -->
        <BaseTab id="settings" label="Settings">
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
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseTab from '@/components/ui/BaseTab.vue'
import BaseTabs from '@/components/ui/BaseTabs.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import BuyingTab from '@/components/dashboard/BuyingTab.vue'
import ProfileTab from '@/components/dashboard/ProfileTab.vue'
import SellingTab from '@/components/dashboard/SellingTab.vue'
import SettingsTab from '@/components/dashboard/SettingsTab.vue'
import { useAppStore } from '@/stores/app'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const app = useAppStore()
const router = useRouter()
const isLoggingOut = ref(false)
const updateError = ref<string | null>(null)
const activeTab = ref('profile')

async function handleLogout() {
  isLoggingOut.value = true
  await app.logout()
  router.push('/marketplace')
}

function goToMarketplace() {
  router.push('/marketplace')
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

/* Header */
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

/* Main content */
.dashboard-main {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-4) var(--space-4) var(--space-8);
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

  .dashboard-main {
    padding: var(--space-2) var(--space-2) var(--space-6);
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
