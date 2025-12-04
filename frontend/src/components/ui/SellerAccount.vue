<template>
  <div class="seller-account">
    <div v-if="organization" class="account-summary">
      <!-- Account Header -->
      <div class="account-header">
        <div class="account-info">
          <h5 class="account-name">{{ organization.name }}</h5>
          <div class="account-email">{{ organization.business_profile?.support_email || organization.email }}</div>
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

      <!-- Account Balance Section -->
      <div class="balance-section">
        <div class="section-header">
          <h6 class="section-title">Account Balance</h6>
          <BaseButton
            variant="ghost"
            size="sm"
            @click="showAddFundsModal = true"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            Add Funds
          </BaseButton>
        </div>
        <div v-if="isLoadingBalance" class="loading-state">Loading balance...</div>
        <div v-else-if="accountBalance" class="balance-grid">
          <div class="balance-item">
            <div class="balance-label">Available</div>
            <div class="balance-amount">
              {{ formatCurrency(accountBalance.available[0]?.amount || 0, accountBalance.available[0]?.currency || accountCurrency) }}
            </div>
          </div>
          <div class="balance-item">
            <div class="balance-label">Pending</div>
            <div class="balance-amount">
              {{ formatCurrency(accountBalance.pending[0]?.amount || 0, accountBalance.pending[0]?.currency || accountCurrency) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Payout Schedule Section -->
      <div class="payout-section">
        <div class="section-header">
          <h6 class="section-title">Payout Schedule</h6>
          <BaseButton
            variant="ghost"
            size="sm"
            @click="showPayoutScheduleModal = true"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit Schedule
          </BaseButton>
        </div>
        <div v-if="isLoadingPayoutSchedule" class="loading-state">Loading schedule...</div>
        <div v-else-if="payoutSchedule" class="schedule-info">
          <div class="schedule-item">
            <span class="schedule-label">Frequency:</span>
            <span class="schedule-value">{{ payoutSchedule.schedule.interval }}</span>
          </div>
          <div v-if="payoutSchedule.schedule.delay_days !== undefined" class="schedule-item">
            <span class="schedule-label">Delay:</span>
            <span class="schedule-value">{{ payoutSchedule.schedule.delay_days }} days</span>
          </div>
          <div v-if="payoutSchedule.schedule.weekly_anchor" class="schedule-item">
            <span class="schedule-label">Weekly Anchor:</span>
            <span class="schedule-value">{{ payoutSchedule.schedule.weekly_anchor }}</span>
          </div>
          <div v-if="payoutSchedule.schedule.monthly_anchor" class="schedule-item">
            <span class="schedule-label">Monthly Anchor:</span>
            <span class="schedule-value">Day {{ payoutSchedule.schedule.monthly_anchor }}</span>
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

    <!-- Add Funds Drawer -->
    <BaseModal
      :show="showAddFundsModal"
      variant="drawer"
      title="Add Funds to Account"
      size="md"
      @close="showAddFundsModal = false"
    >
      <div class="drawer-form">
        <div class="currency-display">
          <div class="currency-label">Currency</div>
          <div class="currency-value">{{ accountCurrency }}</div>
        </div>

        <BaseInput
          v-model="addFundsAmountString"
          label="Amount (cents)"
          type="text"
          placeholder="300"
          hint="Enter amount in cents (e.g., 300 = $3.00)"
        />
      </div>

      <template #footer>
        <BaseButton variant="ghost" @click="showAddFundsModal = false">
          Cancel
        </BaseButton>
        <BaseButton
          variant="primary"
          :loading="isAddingFunds"
          :disabled="isAddingFunds || addFundsForm.amount <= 0"
          @click="handleAddFunds"
        >
          Add {{ formatCurrency(addFundsForm.amount, accountCurrency) }}
        </BaseButton>
      </template>
    </BaseModal>

    <!-- Payout Schedule Drawer -->
    <BaseModal
      :show="showPayoutScheduleModal"
      variant="drawer"
      title="Update Payout Schedule"
      size="md"
      @close="showPayoutScheduleModal = false"
    >
      <div class="drawer-form">
        <div class="form-group">
          <label for="interval" class="form-label">Payout Frequency</label>
          <select id="interval" v-model="payoutScheduleForm.interval" class="form-select">
            <option value="manual">Manual</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        <BaseInput
          v-if="payoutScheduleForm.interval !== 'manual'"
          v-model="delayDaysString"
          label="Delay (days)"
          type="text"
          placeholder="2"
          hint="Number of days to delay payouts (0-30)"
        />

        <div v-if="payoutScheduleForm.interval === 'weekly'" class="form-group">
          <label for="weekly_anchor" class="form-label">Weekly Anchor Day</label>
          <select id="weekly_anchor" v-model="payoutScheduleForm.weekly_anchor" class="form-select">
            <option value="monday">Monday</option>
            <option value="tuesday">Tuesday</option>
            <option value="wednesday">Wednesday</option>
            <option value="thursday">Thursday</option>
            <option value="friday">Friday</option>
            <option value="saturday">Saturday</option>
            <option value="sunday">Sunday</option>
          </select>
        </div>

        <BaseInput
          v-if="payoutScheduleForm.interval === 'monthly'"
          v-model="monthlyAnchorString"
          label="Monthly Anchor Day"
          type="text"
          placeholder="1"
          hint="Day of month for payouts (1-31)"
        />
      </div>

      <template #footer>
        <BaseButton variant="ghost" @click="showPayoutScheduleModal = false">
          Cancel
        </BaseButton>
        <BaseButton
          variant="primary"
          :loading="isUpdatingPayoutSchedule"
          :disabled="isUpdatingPayoutSchedule"
          @click="handleUpdatePayoutSchedule"
        >
          Update Schedule
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>

<script lang="ts" setup>
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import { authAPI } from '@/services/api'
import { useAppStore } from '@/stores/app'
import { computed, onMounted, ref, watch } from 'vue'

const app = useAppStore()
const organization = computed(() => app.organization)

// Get account currency from organization
const accountCurrency = computed(() => organization.value?.currency || 'usd')

const isDashboardLinkLoading = ref(false)
const isRefreshing = ref(false)
const isLoadingBalance = ref(false)
const isLoadingPayoutSchedule = ref(false)
const showAddFundsModal = ref(false)
const showPayoutScheduleModal = ref(false)
const isAddingFunds = ref(false)
const isUpdatingPayoutSchedule = ref(false)

// Account balance state
const accountBalance = ref<{
  available: Array<{ amount: number; currency: string }>
  pending: Array<{ amount: number; currency: string }>
  instant_available?: Array<{ amount: number; currency: string }>
} | null>(null)

// Payout schedule state
const payoutSchedule = ref<{
  schedule: {
    interval: 'manual' | 'daily' | 'weekly' | 'monthly'
    delay_days?: number
    weekly_anchor?: string
    monthly_anchor?: number
  }
  statement_descriptor?: string
  debit_negative_balances?: boolean
} | null>(null)

// Add funds form
const addFundsForm = ref({
  amount: 300 // Default $3.00
})

// String representations for BaseInput (v-model needs string)
const addFundsAmountString = ref('300')
const delayDaysString = ref('2')
const monthlyAnchorString = ref('1')

// Watch for changes and update the form values
watch(addFundsAmountString, (val) => {
  const num = parseInt(val) || 0
  addFundsForm.value.amount = num
})

watch(delayDaysString, (val) => {
  const num = parseInt(val)
  payoutScheduleForm.value.delay_days = isNaN(num) ? undefined : num
})

watch(monthlyAnchorString, (val) => {
  const num = parseInt(val)
  payoutScheduleForm.value.monthly_anchor = isNaN(num) ? undefined : num
})

// Payout schedule form
const payoutScheduleForm = ref<{
  interval: 'manual' | 'daily' | 'weekly' | 'monthly'
  delay_days?: number
  weekly_anchor?: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
  monthly_anchor?: number
}>({
  interval: 'daily',
  delay_days: 2
})

// Helper function to format currency
function formatCurrency(amount: number, currency: string): string {
  return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`
}

// Load account balance
async function loadAccountBalance() {
  if (!organization.value?.stripe_account_id) return

  isLoadingBalance.value = true
  try {
    const balance = await authAPI.getAccountBalance()
    accountBalance.value = balance
  } catch (err) {
    console.error('Failed to load account balance:', err)
  } finally {
    isLoadingBalance.value = false
  }
}

// Load payout schedule
async function loadPayoutSchedule() {
  if (!organization.value?.stripe_account_id) return

  isLoadingPayoutSchedule.value = true
  try {
    const schedule = await authAPI.getPayoutSchedule()
    payoutSchedule.value = schedule
    // Update form with current values
    if (schedule.schedule) {
      payoutScheduleForm.value = {
        interval: schedule.schedule.interval,
        delay_days: schedule.schedule.delay_days,
        weekly_anchor: schedule.schedule.weekly_anchor as 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday' | undefined,
        monthly_anchor: schedule.schedule.monthly_anchor
      }
      // Update string refs
      if (schedule.schedule.delay_days !== undefined) {
        delayDaysString.value = schedule.schedule.delay_days.toString()
      }
      if (schedule.schedule.monthly_anchor !== undefined) {
        monthlyAnchorString.value = schedule.schedule.monthly_anchor.toString()
      }
    }
  } catch (err) {
    console.error('Failed to load payout schedule:', err)
  } finally {
    isLoadingPayoutSchedule.value = false
  }
}

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
    // Refresh balance and schedule too
    await Promise.all([loadAccountBalance(), loadPayoutSchedule()])
  } catch (err) {
    console.error('Failed to refresh organization:', err)
  } finally {
    isRefreshing.value = false
  }
}

// Handler for adding funds
async function handleAddFunds() {
  if (!organization.value?.stripe_account_id) return
  if (addFundsForm.value.amount <= 0) {
    alert('Please enter a valid amount')
    return
  }

  isAddingFunds.value = true

  try {
    await authAPI.addAccountFunds({
      amount: addFundsForm.value.amount,
      currency: accountCurrency.value
    })

    // Close drawer and refresh balance
    showAddFundsModal.value = false
    await loadAccountBalance()

    alert('Funds added successfully!')
  } catch (err) {
    console.error('Failed to add funds:', err)
    alert('Failed to add funds. Please try again.')
  } finally {
    isAddingFunds.value = false
  }
}

// Handler for updating payout schedule
async function handleUpdatePayoutSchedule() {
  if (!organization.value?.stripe_account_id) return

  isUpdatingPayoutSchedule.value = true

  try {
    await authAPI.updatePayoutSchedule(payoutScheduleForm.value)

    // Close modal and refresh schedule
    showPayoutScheduleModal.value = false
    await loadPayoutSchedule()

    alert('Payout schedule updated successfully!')
  } catch (err) {
    console.error('Failed to update payout schedule:', err)
    alert('Failed to update payout schedule. Please try again.')
  } finally {
    isUpdatingPayoutSchedule.value = false
  }
}

// Load data on mount
onMounted(() => {
  if (organization.value?.stripe_account_id) {
    loadAccountBalance()
    loadPayoutSchedule()
  }
})
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
  gap: var(--space-4);
  padding-bottom: var(--space-4);
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
  flex-shrink: 0;
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
  flex-direction: column;
  gap: var(--space-2);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border-light);
}

.action-buttons button {
  width: 100%;
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

/* Balance Section */
.balance-section,
.payout-section {
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border-light);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.section-title {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.section-header button {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.loading-state {
  padding: var(--space-4);
  text-align: center;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.balance-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--space-3);
}

.balance-item {
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-bg-muted);
}

.balance-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-1);
}

.balance-amount {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  font-family: var(--font-mono, 'Menlo', monospace);
}

.schedule-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-bg-muted);
}

.schedule-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--font-size-sm);
}

.schedule-label {
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
}

.schedule-value {
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
  text-transform: capitalize;
}

/* Drawer Form Styles */
.drawer-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.currency-display {
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-bg-muted);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.currency-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.currency-value {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  text-transform: uppercase;
  font-family: var(--font-mono, 'Menlo', monospace);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.form-select {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  transition: all 0.2s ease;
}

.form-select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
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

  .balance-grid {
    grid-template-columns: 1fr;
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }

  .section-header button {
    width: 100%;
  }
}
</style>
