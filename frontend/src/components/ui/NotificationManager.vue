<template>
  <div class="notification-manager">
    <!-- Collapsed/Compact State -->
    <div v-if="!expanded" class="compact-manager">
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
          <div class="notification-types-header">
            <span class="notification-types-title">Notification Preferences</span>
          </div>
          <div class="toggle-grid-wrapper visible">
            <div class="toggle-grid">
              <EditableToggle
                v-for="(config, notifType) in visibleNotificationTypes"
                :key="notifType"
                :value="preferences[notifType]"
                :field="notifType"
                :label="config?.label ?? ''"
                :off-label="''"
                :on-label="''"
                :loading="isInitialLoad"
                @update="handleToggleUpdate"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Expanded State with Notifications List -->
    <div v-else class="expanded-manager">
      <!-- Notifications History Section -->
      <div class="notifications-section">
        <!-- Filter Controls -->
        <div class="filter-controls">
          <div class="filter-groups">
            <div class="filter-group">
              <label class="filter-label">Show:</label>
              <div class="filter-buttons">
                <BaseButton
                  :variant="!filters.unreadOnly ? 'primary' : 'outline'"
                  size="sm"
                  @click="updateFilter('unreadOnly', false)"
                >
                  All
                </BaseButton>
                <BaseButton
                  :variant="filters.unreadOnly ? 'primary' : 'outline'"
                  size="sm"
                  @click="updateFilter('unreadOnly', true)"
                >
                  Unread
                </BaseButton>
              </div>
            </div>

            <div class="filter-group filter-select">
              <EditableSelect
                :value="filters.type"
                field="type"
                label=""
                :options="filterNotificationTypes"
                :searchable="true"
                placeholder="All Types"
                @update="handleTypeFilterUpdate"
              />
            </div>
          </div>

          <BaseButton
            variant="primary"
            size="sm"
            :disabled="isMarkingAllRead || app.unreadNotificationCount === 0"
            :loading="isMarkingAllRead"
            @click="handleMarkAllAsRead"
          >
            <svg
              v-if="!isMarkingAllRead"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Mark all as read
          </BaseButton>
        </div>

        <div v-if="isLoadingNotifications && notifications.length === 0" class="loading-state">
          <LoadingSpinner :size="32" />
          <p class="loading-text">Loading notifications...</p>
        </div>

        <div v-else-if="!isLoadingNotifications && notifications.length === 0" class="empty-state">
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
          <NotificationItem
            v-for="notification in notifications"
            :key="notification.id"
            :notification="notification"
            :is-expanded="expandedNotifications.has(notification.id)"
            @click="handleNotificationClick"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { authAPI } from '@/services/api'
import { useAppStore } from '@/stores/app'
import { USER_NOTIFICATION_TYPES } from '@marketplace/constants'
import type { Notification, NotificationType, SelectOption, User } from '@marketplace/types'
import { computed, onMounted, ref } from 'vue'
import BaseButton from './BaseButton.vue'
import EditableSelect from './EditableSelect.vue'
import EditableToggle from './EditableToggle.vue'
import LoadingSpinner from './LoadingSpinner.vue'
import NotificationItem from './NotificationItem.vue'

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
const markingAsRead = ref(new Set<string>())
const isMarkingAllRead = ref(false)
const expandedNotifications = ref(new Set<string>())
const filters = ref<{
  unreadOnly: boolean
  type: string
}>({
  unreadOnly: false,
  type: '',
})

// Optimistic preferences state
const optimisticPreferences = ref<{
  email_enabled?: boolean
  sms_enabled?: boolean
  [key: string]: boolean | undefined
}>({})

// Computed
const userHasPhone = computed(() => !!app.user?.phone_number)
const userHasStripeAccount = computed(() => !!app?.organization?.stripe_account_id)

// Filter notification types based on user's Stripe account status and exclude system
const visibleNotificationTypes = computed(() => {
  const filtered: Partial<Record<NotificationType, { label: string; requiresStripeAccount?: boolean }>> = {}

  for (const [key, config] of Object.entries(USER_NOTIFICATION_TYPES) as [NotificationType, { label: string; requiresStripeAccount?: boolean }][]) {
    // Exclude 'system' notifications as they can't be toggled
    if (key === 'system') continue

    // Include if no Stripe account required, or user has Stripe account
    if (!config.requiresStripeAccount || userHasStripeAccount.value) {
      filtered[key] = config
    }
  }

  return filtered
})

// Dynamic filter types for notification filtering as SelectOptions
const filterNotificationTypes = computed((): SelectOption[] => {
  const types: SelectOption[] = [
    { value: '', label: 'All Types' }
  ]

  for (const [key, config] of Object.entries(USER_NOTIFICATION_TYPES) as [NotificationType, { label: string; requiresStripeAccount?: boolean }][]) {
    // Exclude 'system' notifications from filters
    if (key === 'system') continue

    // Include if no Stripe account required, or user has Stripe account
    if (!config.requiresStripeAccount || userHasStripeAccount.value) {
      types.push({
        value: key,
        label: config.label,
      })
    }
  }

  return types
})

// Notification preferences from user entity, with optimistic override
const preferences = computed(() => {
  const prefs: Record<string, boolean> = {
    email_enabled: optimisticPreferences.value.email_enabled ?? app.user?.notifications?.email ?? true,
    sms_enabled: optimisticPreferences.value.sms_enabled ?? app.user?.notifications?.sms ?? false,
  }

  // Dynamically add all notification type preferences (excluding system)
  for (const notifType of Object.keys(USER_NOTIFICATION_TYPES)) {
    if (notifType === 'system') continue

    prefs[notifType] = optimisticPreferences.value[notifType] ??
      !(app.user?.notification_opt_out?.[notifType] ?? false)
  }

  return prefs
})

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
    } else {
      // All other fields are notification types - update notification_opt_out object (inverted logic)
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
      unreadOnly: filters.value.unreadOnly,
      type: filters.value.type || undefined,
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

async function updateFilter(field: 'unreadOnly' | 'type', value: boolean | string) {
  if (field === 'unreadOnly') {
    filters.value.unreadOnly = value as boolean
  } else if (field === 'type') {
    filters.value.type = value as string
  }

  // Reload notifications with new filters
  await loadNotifications()
}

// Wrapper for EditableSelect to handle type filtering
async function handleTypeFilterUpdate(field: string, value: string) {
  await updateFilter('type', value)
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
    // Update unread count
    app.unreadNotificationCount = Math.max(0, app.unreadNotificationCount - 1)
  } catch (error) {
    console.error('Failed to mark as read:', error)
    // Revert optimistic update on error
    notifications.value = previousNotifications
  } finally {
    markingAsRead.value.delete(notificationId)
  }
}

async function handleMarkAllAsRead() {
  if (app.unreadNotificationCount === 0) return

  isMarkingAllRead.value = true

  // Store previous state for potential rollback
  const previousNotifications = [...notifications.value]
  const previousUnreadCount = app.unreadNotificationCount

  // Optimistically mark all as read
  notifications.value = notifications.value.map((n) => ({ ...n, read: true }))
  app.unreadNotificationCount = 0

  try {
    await authAPI.markAllNotificationsAsRead()
    // Reload notifications to get fresh state
    await loadNotifications()
  } catch (error) {
    console.error('Failed to mark all as read:', error)
    // Revert optimistic updates on error
    notifications.value = previousNotifications
    app.unreadNotificationCount = previousUnreadCount
  } finally {
    isMarkingAllRead.value = false
  }
}

function toggleNotificationExpand(notificationId: string) {
  if (expandedNotifications.value.has(notificationId)) {
    expandedNotifications.value.delete(notificationId)
  } else {
    expandedNotifications.value.add(notificationId)
  }
}

async function handleNotificationClick(notification: Notification) {
  // Toggle expansion
  toggleNotificationExpand(notification.id)

  // Mark as read if unread
  if (!notification.read) {
    await markAsRead(notification.id)
  }
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
  padding-top: var(--space-4);
}

.notification-types-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) 0;
  margin-bottom: var(--space-2);
}

.notification-types-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.toggle-grid-wrapper {
  opacity: 1;
}

.toggle-grid-wrapper.visible {
  opacity: 1;
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

/* Filter Controls */
.filter-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
  padding: var(--space-3);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  flex-wrap: wrap;
}

.filter-groups {
  display: flex;
  gap: var(--space-6);
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.filter-select {
  min-width: 200px;
  max-width: 250px;
}

.filter-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  margin: 0;
}

.filter-buttons {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
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

/* Responsive */
@media (max-width: 640px) {
  .toggle-row {
    flex-direction: column;
  }

  .filter-controls {
    flex-direction: column;
    gap: var(--space-3);
  }

  .filter-groups {
    width: 100%;
    flex-direction: column;
    gap: var(--space-3);
  }

  .filter-group {
    width: 100%;
    flex-direction: column;
    align-items: flex-start;
  }

  .filter-buttons {
    width: 100%;
  }
}
</style>
