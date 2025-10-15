<template>
  <div class="profile-tab">
    <div class="tab-grid">
      <!-- Profile Information Card -->
      <BaseCard title="Profile" :min-height="280">
        <template v-if="!app.user">
          <BaseSkeleton variant="card" :height="200" />
        </template>
        <template v-else>
          <div class="profile-info">
            <div class="row">
              <EditableField
                label="First Name"
                :value="app.user.given_name || ''"
                field="given_name"
                @update="handleFieldUpdate"
                :loading="fieldUpdating === 'given_name'"
              />
              <EditableField
                label="Last Name"
                :value="app.user.family_name || ''"
                field="family_name"
                @update="handleFieldUpdate"
                :loading="fieldUpdating === 'family_name'"
              />
            </div>
            <PhoneNumberField
              label="Phone"
              :value="app.user.phone_number || ''"
              field="phone_number"
              @update="handleFieldUpdate"
              :loading="fieldUpdating === 'phone_number'"
            />
            <AddressSearch
              label="Address"
              :value="formatAddress(app.user.address ?? {}) || ''"
              field="address"
              @update="handleFieldUpdate"
              :loading="fieldUpdating === 'address'"
            />
          </div>
        </template>
      </BaseCard>

      <!-- Notifications Card -->
      <BaseCard
        title="Notifications"
        :expandable="true"
        :badge="app.unreadNotificationCount > 0 ? app.unreadNotificationCount : undefined"
        :min-height="280"
        ref="notificationCard"
      >
        <template #default="{ expanded }">
          <NotificationManager :expanded="expanded" />
        </template>
      </BaseCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import AddressSearch from '@/components/ui/AddressSearch.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue'
import EditableField from '@/components/ui/EditableField.vue'
import NotificationManager from '@/components/ui/NotificationManager.vue'
import PhoneNumberField from '@/components/ui/PhoneNumberField.vue'
import { useAppStore } from '@/stores/app'
import { ref } from 'vue'

const app = useAppStore()
const fieldUpdating = ref<string | null>(null)
const notificationCard = ref<InstanceType<typeof BaseCard>>()

const allowedFields = ['given_name', 'family_name', 'name', 'phone_number', 'address']

defineProps<{
  updateError: string | null
}>()

const emit = defineEmits<{
  'update:updateError': [value: string | null]
}>()

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
  emit('update:updateError', null)

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
      emit('update:updateError', result.error || 'Failed to update field')
    }
  } catch (error) {
    emit('update:updateError', 'Failed to update field')
    console.error('Field update error:', error)
  } finally {
    fieldUpdating.value = null
  }
}
</script>

<style scoped>
.profile-tab {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.tab-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
  gap: var(--space-6);
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.tab-grid > * {
  min-width: 0;
  max-width: 100%;
}

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

.profile-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

@media (max-width: 768px) {
  .tab-grid {
    grid-template-columns: 1fr;
  }

  .row {
    flex-direction: column;
  }
}
</style>
