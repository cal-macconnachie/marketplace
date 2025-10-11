<template>
  <div class="notification-manager">
    <!-- Collapsed/Compact State -->
    <div v-if="!expanded" class="compact-manager">
      <div v-if="unreadCount > 0" class="notification-badge">
        <span class="badge-count">{{ unreadCount }}</span>
        <span class="badge-label">unread notification{{ unreadCount === 1 ? '' : 's' }}</span>
      </div>
      <div class="notification-toggles">
        <div class="toggle-section">
          <div class="toggle-row">
            <EditableToggle
              :value="preferences.email_enabled"
              field="email_enabled"
              label="Email"
              :off-label="''"
              :on-label="''"
              :loading="isInitialLoad"
              @update="handleToggleUpdate"
            />
            <EditableToggle
              :value="preferences.sms_enabled"
              field="sms_enabled"
              label="SMS"
              :off-label="''"
              :on-label="''"
              :loading="isInitialLoad"
              :disabled="!userHasPhone"
              @update="handleToggleUpdate"
            />
          </div>
        </div>

        <div class="toggle-section notification-types">
          <div class="toggle-grid">
            <EditableToggle
              :value="preferences.receipts"
              field="receipts"
              label="Receipts"
              :off-label="''"
              :on-label="''"
              :loading="isInitialLoad"
              @update="handleToggleUpdate"
            />
            <EditableToggle
              v-if="userHasStripeAccount"
              :value="preferences.sales"
              field="sales"
              label="Sales"
              :off-label="''"
              :on-label="''"
              :loading="isInitialLoad"
              @update="handleToggleUpdate"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Expanded State with Notifications List -->
    <div v-else class="expanded-manager">
      <!-- Notifications History Section -->
      <div class="notifications-section">
        <div class="section-header">
          <h4 class="section-title">Recent Notifications</h4>
          <BaseButton
            variant="ghost"
            size="sm"
            :loading="isRefreshing"
            :disabled="isRefreshing"
            @click="refreshNotifications"
          >
            <svg
              width="14"
              height="14"
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
            Refresh
          </BaseButton>
        </div>

        <div v-if="isLoadingNotifications" class="loading-state">
          <LoadingSpinner :size="32" />
          <p class="loading-text">Loading notifications...</p>
        </div>

        <div v-else-if="notifications.length === 0" class="empty-state">
          <div class="empty-icon">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <p class="empty-text">No notifications yet</p>
          <p class="empty-subtext">You'll see receipts and sales notifications here</p>
        </div>

        <div v-else class="notifications-list">
          <div
            v-for="notification in notifications"
            :key="notification.id"
            :class="['notification-item', { unread: !notification.read }]"
          >
            <div class="notification-indicator">
              <div v-if="!notification.read" class="unread-dot"></div>
            </div>
            <div class="notification-content">
              <div class="notification-header">
                <h5 class="notification-title">{{ notification.title }}</h5>
                <span class="notification-time">{{ formatTimestamp(notification.created_at) }}</span>
              </div>
              <p class="notification-message">{{ notification.message }}</p>
              <div v-if="notification.metadata" class="notification-metadata">
                <span
                  v-if="notification.metadata.type"
                  :class="['notification-type', `type-${notification.metadata.type}`]"
                >
                  {{ formatNotificationType(notification.type) }}
                </span>
              </div>
            </div>
            <div class="notification-actions">
              <BaseButton
                v-if="!notification.read"
                variant="ghost"
                size="sm"
                @click="markAsRead(notification.id)"
                :loading="markingAsRead.has(notification.id)"
              >
                Mark Read
              </BaseButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { authAPI } from '@/services/api'
import { useAppStore } from '@/stores/app'
import type { Notification, User } from '@marketplace/types'
import { computed, onMounted, ref } from 'vue'
import BaseButton from './BaseButton.vue'
import EditableToggle from './EditableToggle.vue'
import LoadingSpinner from './LoadingSpinner.vue'

interface Props {
  expanded?: boolean
}

withDefaults(defineProps<Props>(), {
  expanded: false,
})

const app = useAppStore()

// State
const notifications = ref<Notification[]>([])
const isInitialLoad = ref(true)
const isLoadingNotifications = ref(false)
const isRefreshing = ref(false)
const markingAsRead = ref(new Set<string>())

// Optimistic preferences state
const optimisticPreferences = ref<{
  email_enabled?: boolean
  sms_enabled?: boolean
  receipts?: boolean
  sales?: boolean
}>({})

// Computed
const userHasPhone = computed(() => !!app.user?.phone_number)
const userHasStripeAccount = computed(() => !!app?.organization?.stripe_account_id)

// Count unread notifications
const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)

// Notification preferences from user entity, with optimistic override
const preferences = computed(() => ({
  email_enabled: optimisticPreferences.value.email_enabled ?? app.user?.notifications?.email ?? true,
  sms_enabled: optimisticPreferences.value.sms_enabled ?? app.user?.notifications?.sms ?? false,
  receipts: optimisticPreferences.value.receipts ?? !(app.user?.notification_opt_out?.receipts ?? false),
  sales: optimisticPreferences.value.sales ?? !(app.user?.notification_opt_out?.sales ?? false),
}))

// Methods
async function handleToggleUpdate(field: string, value: boolean) {
  if (!app.user?.id) return

  // Optimistically update the UI
  optimisticPreferences.value = {
    ...optimisticPreferences.value,
    [field]: value,
  }

  try {
    // Prepare user update based on field
    let updates: Partial<User> = {}

    if (field === 'email_enabled' || field === 'sms_enabled') {
      // Update notifications object
      const notificationType = field === 'email_enabled' ? 'email' : 'sms'
      updates = {
        notifications: {
          ...app.user.notifications,
          [notificationType]: value,
        } as User['notifications']
      }
    } else if (field === 'receipts' || field === 'sales') {
      // Update notification_opt_out object (inverted logic)
      updates = {
        notification_opt_out: {
          ...app.user.notification_opt_out,
          [field]: !value, // Inverted: true means enabled, so opt_out = false
        }
      }
    }

    // Call API to update user
    const result = await app.updateUser(updates)

    if (!result.success) {
      throw new Error(result.error || 'Failed to update preferences')
    }

    // Clear optimistic state and let the real value from store take over
    // If the returned value is different, it will show the correct state
    optimisticPreferences.value = {
      ...optimisticPreferences.value,
      [field]: undefined,
    }
  } catch (error) {
    console.error('Failed to update preference:', error)
    // Revert optimistic update on error
    optimisticPreferences.value = {
      ...optimisticPreferences.value,
      [field]: undefined,
    }
  }
}

async function loadNotifications() {
  if (!app.user?.id) return

  isLoadingNotifications.value = true
  try {
    const response = await authAPI.getNotifications({
      limit: 50,
      unreadOnly: false
    })

    if ('notifications' in response) {
      notifications.value = response.notifications
    }
  } catch (error) {
    console.error('Failed to load notifications:', error)
  } finally {
    isLoadingNotifications.value = false
  }
}

async function refreshNotifications() {
  isRefreshing.value = true
  try {
    await loadNotifications()
  } finally {
    isRefreshing.value = false
  }
}

async function markAsRead(notificationId: string) {
  markingAsRead.value.add(notificationId)

  // Store previous state for potential rollback
  const previousNotifications = [...notifications.value]

  // Optimistically update local state immediately
  notifications.value = notifications.value.map((n) =>
    n.id === notificationId ? { ...n, read: true } : n
  )

  try {
    await authAPI.markNotificationAsRead(notificationId)
  } catch (error) {
    console.error('Failed to mark as read:', error)
    // Revert optimistic update on error
    notifications.value = previousNotifications
  } finally {
    markingAsRead.value.delete(notificationId)
  }
}

function formatTimestamp(timestamp: number): string {
  // Date.now() returns milliseconds, so use timestamp directly
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

function formatNotificationType(type: string): string {
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Lifecycle
onMounted(async () => {
  // Mark initial load as complete since preferences are loaded from app store
  isInitialLoad.value = false

  // Always load notifications to show the badge count
  await loadNotifications()
})
</script>

<style scoped>
.notification-manager {
  width: 100%;
}

/* Compact Manager */
.compact-manager {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* Notification Badge */
.notification-badge {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-primary-alpha);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-2);
}

.badge-count {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 var(--space-2);
  background: var(--color-primary);
  color: white;
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  line-height: 1;
}

.badge-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
}

/* Toggle Sections */
.notification-toggles {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.toggle-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.notification-types {
  border-top: 1px solid var(--color-border);
  padding-top: 1em;
}

.toggle-row {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
}

.toggle-row > * {
  flex: 1;
}

.toggle-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--space-3);
}

/* Expanded Manager */
.expanded-manager {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.section-title {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.preferences-section {
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

/* Notifications Section */
.notifications-section {
  display: flex;
  flex-direction: column;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  gap: var(--space-3);
}

.loading-text {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  text-align: center;
}

.empty-icon {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-3);
  color: var(--color-text-secondary);
  opacity: 0.5;
}

.empty-text {
  margin: 0 0 var(--space-1) 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.empty-subtext {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

/* Notifications List */
.notifications-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.notification-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
}

.notification-item.unread {
  background: var(--color-bg-muted);
  border-color: var(--color-primary-alpha);
}

.notification-item:hover {
  border-color: var(--color-border-hover);
}

.notification-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  flex-shrink: 0;
  padding-top: var(--space-1);
}

.unread-dot {
  width: 8px;
  height: 8px;
  background: var(--color-primary);
  border-radius: 50%;
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.notification-title {
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.notification-time {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.notification-message {
  margin: 0 0 var(--space-2) 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.notification-metadata {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.notification-type {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
}

.notification-type.type-receipt {
  background: rgba(59, 130, 246, 0.1);
  color: rgb(59, 130, 246);
}

.notification-type.type-sale {
  background: rgba(34, 197, 94, 0.1);
  color: rgb(34, 197, 94);
}

.notification-actions {
  display: flex;
  align-items: flex-start;
  flex-shrink: 0;
}

/* Responsive */
@media (max-width: 640px) {
  .toggle-row {
    flex-direction: column;
  }

  .notification-item {
    flex-direction: column;
    gap: var(--space-2);
  }

  .notification-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-1);
  }

  .notification-actions {
    width: 100%;
  }

  .notification-actions button {
    width: 100%;
  }
}
</style>
