<template>
  <div class="seller-account">
    <div v-if="organization" class="account-summary">
      <!-- Account Header -->
      <div class="account-header">
        <div class="account-info">
          <h5 class="account-name">{{ organization.name }}</h5>
          <div class="account-email">{{ organization.business_profile?.support_email || organization.email }}</div>
        </div>
        <div class="account-status">
          <div class="status-indicator completed">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="m9 12 2 2 4-4" />
              <circle cx="12" cy="12" r="10" />
            </svg>
            Verified
          </div>
        </div>
      </div>

      <!-- Capabilities Grid -->
      <div class="capabilities-grid">
        <div class="capability-card">
          <div class="capability-icon">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M2 12h20" />
              <path d="M10 18l6-6-6-6" />
            </svg>
          </div>
          <div class="capability-info">
            <div class="capability-title">Accept Payments</div>
            <div
              :class="[
                'capability-status',
                organization.charges_enabled ? 'enabled' : 'disabled',
              ]"
            >
              {{ organization.charges_enabled ? 'Active' : 'Inactive' }}
            </div>
          </div>
          <div class="capability-indicator">
            <div
              :class="['status-dot', organization.charges_enabled ? 'active' : 'inactive']"
            ></div>
          </div>
        </div>

        <div class="capability-card">
          <div class="capability-icon">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M12 2v20" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div class="capability-info">
            <div class="capability-title">Receive Payouts</div>
            <div
              :class="[
                'capability-status',
                organization.payouts_enabled ? 'enabled' : 'disabled',
              ]"
            >
              {{ organization.payouts_enabled ? 'Active' : 'Inactive' }}
            </div>
          </div>
          <div class="capability-indicator">
            <div
              :class="['status-dot', organization.payouts_enabled ? 'active' : 'inactive']"
            ></div>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="action-buttons">
        <BaseButton
          variant="primary"
          size="md"
          :loading="isDashboardLinkLoading"
          :disabled="isDashboardLinkLoading"
          @click="openStripeDashboard"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="9" y1="21" x2="9" y2="9" />
          </svg>
          Access Stripe Dashboard
        </BaseButton>
        <BaseButton
          variant="ghost"
          size="md"
          :loading="isRefreshing"
          :disabled="isRefreshing"
          @click="refreshOrganization"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
          Refresh Status
        </BaseButton>
      </div>
    </div>

    <div v-else class="no-account">
      <p>No seller account found</p>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useAppStore } from '@/stores/app'
import BaseButton from '@/components/ui/BaseButton.vue'
import { authAPI } from '@/services/api'

const app = useAppStore()
const organization = computed(() => app.organization)

const isDashboardLinkLoading = ref(false)
const isRefreshing = ref(false)

// Handler for opening Stripe Express Dashboard
async function openStripeDashboard() {
  if (!organization.value?.stripe_account_id) return

  isDashboardLinkLoading.value = true

  try {
    const response = await authAPI.createExpressLoginLink()

    if (response.login_url) {
      // Open in new window/tab
      window.open(response.login_url, '_blank')
    }
  } catch (err) {
    console.error('Failed to create Express login link:', err)
  } finally {
    isDashboardLinkLoading.value = false
  }
}

// Handler for refreshing organization status
async function refreshOrganization() {
  if (!organization.value?.id) return

  isRefreshing.value = true

  try {
    const updatedOrg = await authAPI.getOrganization(organization.value.id)
    // Update the store with fresh data
    if (app.organization) {
      Object.assign(app.organization, updatedOrg)
    }
  } catch (err) {
    console.error('Failed to refresh organization:', err)
  } finally {
    isRefreshing.value = false
  }
}
</script>

<style scoped>
.seller-account {
  width: 100%;
}

.account-summary {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.account-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border-light);
}

.account-info {
  flex: 1;
}

.account-name {
  margin: 0 0 var(--space-1) 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.account-email {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  font-family: var(--font-mono, 'Menlo', monospace);
}

.account-status {
  display: flex;
  align-items: center;
}

.status-indicator {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.status-indicator.completed {
  background: rgba(34, 197, 94, 0.1);
  color: rgb(34, 197, 94);
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.capabilities-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-3);
}

.capability-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-bg-muted);
  transition: all 0.2s ease;
}

.capability-card:hover {
  background: var(--color-bg-secondary);
}

.capability-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.capability-info {
  flex: 1;
  min-width: 0;
}

.capability-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  margin-bottom: var(--space-1);
}

.capability-status {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

.capability-status.enabled {
  color: rgb(34, 197, 94);
}

.capability-status.disabled {
  color: var(--color-text-secondary);
}

.capability-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.active {
  background: rgb(34, 197, 94);
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2);
}

.status-dot.inactive {
  background: var(--color-text-secondary);
}

.action-buttons {
  display: flex;
  gap: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border-light);
}

.action-buttons button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
}

.no-account {
  padding: var(--space-4);
  text-align: center;
  color: var(--color-text-secondary);
}

.no-account p {
  margin: 0;
}

/* Responsive */
@media (max-width: 640px) {
  .account-header {
    flex-direction: column;
    gap: var(--space-3);
  }

  .account-status {
    align-self: flex-start;
  }

  .capabilities-grid {
    grid-template-columns: 1fr;
  }

  .action-buttons {
    flex-direction: column;
  }

  .action-buttons button {
    width: 100%;
  }
}
</style>
