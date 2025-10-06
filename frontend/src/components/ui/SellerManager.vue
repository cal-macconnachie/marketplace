<template>
  <div class="seller-manager">
    <!-- Loading Overlay -->
    <div v-if="isSubmitting" class="loading-overlay">
      <div class="loading-content">
        <LoadingSpinner :size="48" />
        <p class="loading-text">Setting up your seller account...</p>
        <p class="loading-subtext">This may take a moment. Please don't close this page.</p>
      </div>
    </div>

    <!-- Status Display for existing sellers -->
    <div v-if="organization?.stripe_account_id" class="status-section">
      <!-- Completed Account Summary Card -->
      <div v-if="organization.onboarding_status === 'completed'" class="vendor-account-card">
        <div class="account-header">
          <div class="account-info">
            <h5 class="account-name">{{ organization.name }}</h5>
            <div class="account-id">{{ organization.business_profile?.support_email }}</div>
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
            <BaseButton
              variant="ghost"
              size="sm"
              :loading="isRefreshing"
              :disabled="isRefreshing"
              @click="refreshOrganization"
              class="refresh-button"
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
        </div>

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
          <div class="capability-card">
            <BaseButton
              class="dashboard-button"
              variant="secondary"
              size="sm"
              :loading="isDashboardLinkLoading"
              :disabled="isDashboardLinkLoading"
              @click="openStripeDashboard"
            >
              Access Stripe Dashboard
            </BaseButton>
          </div>
        </div>

        <!-- Business Details -->
        <div v-if="props.expanded" class="business-details">
          <div class="details-row" v-if="organization.phone">
            <span class="detail-label">Phone:</span>
            <span class="detail-value">{{ organization.phone }}</span>
          </div>
          <div class="details-row" v-if="organization.business_profile?.url">
            <span class="detail-label">Website:</span>
            <a :href="organization.business_profile.url" target="_blank" class="detail-link">
              {{ organization.business_profile.url }}
            </a>
          </div>
          <div class="details-row" v-if="organization.address">
            <span class="detail-label">Address:</span>
            <span class="detail-value">
              {{ formatAddress(organization.address) }}
            </span>
          </div>
          <div class="details-row" v-if="organization.onboarding_completed_at">
            <span class="detail-label">Verified:</span>
            <span class="detail-value">{{ formatDate(organization.onboarding_completed_at) }}</span>
          </div>
        </div>
      </div>

      <!-- In Progress Status -->
      <div
        v-else-if="
          organization.onboarding_status === 'in_progress' ||
          organization.onboarding_status === 'requires_action'
        "
        class="progress-card"
      >
        <div class="progress-header">
          <div class="progress-icon">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              />
            </svg>
          </div>
          <div class="progress-info">
            <h5>Account Setup In Progress</h5>
            <p>Complete your vendor verification with Stripe</p>
            <div class="progress-note">
              If the link shows no required actions it may take up to 24 hours to approve your
              account
            </div>
          </div>
          <!-- Requirements Badge (when not expanded) -->
          <div v-if="!props.expanded && uniqueRequirementsCount > 0" class="requirements-badge">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{{ uniqueRequirementsCount }}</span>
          </div>
        </div>
        <div class="progress-actions">
          <a
            v-if="organization.onboarding_url"
            :href="organization.onboarding_url"
            class="stripe-link"
          >
            Continue Setup in Stripe →
          </a>
          <BaseButton
            variant="ghost"
            size="sm"
            :loading="isRefreshing"
            :disabled="isRefreshing"
            @click="refreshOrganization"
            class="refresh-button"
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
            Refresh Status
          </BaseButton>
        </div>
      </div>

      <!-- Expanded content only -->
      <template v-if="props.expanded">
        <div v-if="organization.missing_requirements?.length" class="requirements-section">
          <h5>Missing Requirements</h5>
          <div
            v-for="(group, groupName) in groupRequirements(organization.missing_requirements)"
            :key="groupName"
            class="requirement-group"
          >
            <h6 class="requirement-group-title">{{ group.name }}</h6>
            <ul class="requirements-list">
              <li v-for="(item, index) in group.items" :key="`${groupName}-${index}`">
                {{ item }}
              </li>
            </ul>
          </div>
        </div>
      </template>
    </div>

    <!-- Onboarding for new sellers -->
    <div v-else class="onboarding-section">
      <div v-if="!props.expanded" class="setup-prompt">
        <div class="prompt-header">
          <div class="prompt-icon">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M9 12l2 2 4-4" />
              <circle cx="12" cy="12" r="10" />
            </svg>
          </div>
          <div class="prompt-info">
            <h5>Ready to start selling?</h5>
            <p>Complete your vendor setup to start accepting payments</p>
          </div>
        </div>
        <BaseButton
          class="cta-button"
          :disabled="isSubmitting"
          :loading="isSubmitting"
          @click="() => emit('get-started')"
          >Get Started</BaseButton
        >
      </div>

      <!-- Only show full form in expanded view -->
      <template v-if="props.expanded">
        <form @submit.prevent="handleSubmit" class="onboarding-form">
          <!-- Company Details -->
          <div class="form-section">
            <div class="form-grid">
              <div class="form-field full-width">
                <EditableField
                  :value="formData.companyDetails.name"
                  field="companyName"
                  label="Company Name *"
                  placeholder="Your Company Name"
                  :loading="isSubmitting"
                  :required="true"
                  :error="validationErrors.companyName"
                  @update="handleFieldUpdate"
                />
              </div>

              <div class="form-field">
                <EditableField
                  :value="formData.individual.relationship.title"
                  field="jobTitle"
                  label="Job Title *"
                  placeholder="CEO, Owner, Manager, etc."
                  :loading="isSubmitting"
                  :required="true"
                  :error="validationErrors.jobTitle"
                  @update="handleFieldUpdate"
                />
              </div>
              <div class="form-field">
                <EditableField
                  :value="formData.companyDetails.phone"
                  field="phone"
                  label="Phone Number *"
                  placeholder="+1 (555) 123-4567"
                  :loading="isSubmitting"
                  :required="true"
                  :error="validationErrors.phone"
                  @update="handleFieldUpdate"
                />
              </div>

              <div class="form-field">
                <EditableField
                  :value="formData.companyDetails.tax_id"
                  field="taxId"
                  label="Tax ID"
                  placeholder="EIN or SSN"
                  :loading="isSubmitting"
                  @update="handleFieldUpdate"
                />
              </div>
              <div class="form-field full-width">
                <AddressSearch
                  :value="formattedAddress"
                  field="address"
                  label="Company Address *"
                  placeholder="Search for your business address..."
                  :loading="isSubmitting"
                  :short-codes="true"
                  :required="true"
                  :error="
                    validationErrors.address ||
                    validationErrors.addressCity ||
                    validationErrors.addressState ||
                    validationErrors.addressPostal
                  "
                  @update="handleAddressUpdate"
                />
              </div>
            </div>
          </div>

          <!-- Bank Details -->
          <div class="form-section">
            <div class="form-grid">
              <div class="form-field full-width">
                <EditableField
                  :value="formData.bankDetails.account_holder_name"
                  field="accountHolderName"
                  label="Account Holder Name *"
                  placeholder="John Doe"
                  :loading="isSubmitting"
                  @update="handleFieldUpdate"
                />
              </div>
              <div class="form-field">
                <EditableField
                  :value="formData.individual.phone"
                  field="individualPhone"
                  label="Personal Phone Number *"
                  placeholder="+1 (555) 123-4567"
                  :loading="isSubmitting"
                  :required="true"
                  :error="validationErrors.individualPhone"
                  @update="handleFieldUpdate"
                />
              </div>

              <div class="form-field">
                <EditableDate
                  :value="formattedDob"
                  field="dob"
                  label="Date of Birth *"
                  :loading="isSubmitting"
                  :error="validationErrors.dob"
                  @update="handleFieldUpdate"
                />
              </div>

              <div class="form-field">
                <EditableSelect
                  :value="formData.bankDetails.account_holder_type"
                  field="accountType"
                  label="Account Type *"
                  :options="accountTypeOptions"
                  :loading="isSubmitting"
                  @update="handleFieldUpdate"
                />
              </div>

              <div class="form-field">
                <EditableField
                  :value="formData.bankDetails.routing_number"
                  field="routingNumber"
                  label="Routing Number *"
                  placeholder="110000000"
                  :loading="isSubmitting"
                  @update="handleFieldUpdate"
                />
              </div>

              <div class="form-field">
                <EditableField
                  :value="formData.bankDetails.account_number"
                  field="accountNumber"
                  label="Account Number *"
                  placeholder="000123456789"
                  :loading="isSubmitting"
                  :required="true"
                  :error="validationErrors.accountNumber"
                  @update="handleFieldUpdate"
                />
              </div>
            </div>
          </div>

          <!-- Business Profile (Optional) -->
          <div class="form-section">
            <div class="form-grid">
              <div class="form-field">
                <EditableField
                  :value="formData.businessProfile.url"
                  field="websiteUrl"
                  label="Website URL"
                  placeholder="https://example.com"
                  :loading="isSubmitting"
                  @update="handleFieldUpdate"
                />
              </div>

              <div class="form-field">
                <EditableField
                  :value="formData.businessProfile.product_description"
                  field="productDescription"
                  label="Product Description"
                  type="textarea"
                  placeholder="Describe what products or services you sell"
                  :loading="isSubmitting"
                  @update="handleFieldUpdate"
                />
              </div>
            </div>
          </div>

          <!-- Error Display -->
          <BaseAlert
            v-if="error"
            variant="error"
            :message="error"
            :show="!!error"
            dismissible
            @dismiss="error = null"
          />

          <!-- Terms of Service Notice -->
          <div class="tos-notice">
            <p class="tos-text">
              By clicking "Start Vendor Setup", you agree to Stripe's
              <a href="https://stripe.com/connect-account/legal" target="_blank" class="tos-link">
                Connected Account Agreement
              </a>
              and our platform's terms of service.
            </p>
          </div>

          <!-- Submit Button -->
          <div class="form-actions">
            <BaseButton
              type="submit"
              variant="primary"
              :loading="isSubmitting"
              :disabled="isSubmitting"
            >
              Start Vendor Setup
            </BaseButton>
          </div>
        </form>
      </template>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import EditableField from '@/components/ui/EditableField.vue'
import EditableSelect from '@/components/ui/EditableSelect.vue'
import EditableDate from '@/components/ui/EditableDate.vue'
import AddressSearch from '@/components/ui/AddressSearch.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import { authAPI } from '@/services/api'
import type { Organization } from '@marketplace/types'

// Define props
interface Props {
  expanded?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  expanded: false,
})
const emit = defineEmits(['get-started'])
const app = useAppStore()
const user = computed(() => app.user)
const organization = computed(() => app.organization)

// Computed property for unique requirements count
const uniqueRequirementsCount = computed(() => {
  if (!organization.value?.missing_requirements?.length) return 0
  return [...new Set(organization.value.missing_requirements)].length
})

const isSubmitting = ref(false)
const error = ref<string | null>(null)
const validationErrors = ref<Record<string, string>>({})
const isRefreshing = ref(false)
const isDashboardLinkLoading = ref(false)

// Options for account type select
const accountTypeOptions = [
  { value: 'individual', label: 'Individual' },
  { value: 'company', label: 'Company' },
]

// Computed property for formatted address
const formattedAddress = computed(() => {
  const addr = formData.value.companyDetails.address
  if (!addr.line1) return ''

  const parts = [
    addr.line1,
    addr.line2,
    addr.city,
    addr.state,
    addr.postal_code,
    addr.country,
  ].filter(Boolean)

  return parts.join(', ')
})

// Computed property for formatted date of birth
const formattedDob = computed(() => {
  const { year, month, day } = formData.value.individual.dob
  if (!year || !month || !day) return ''

  // Format as YYYY-MM-DD for HTML date input
  const paddedMonth = month.toString().padStart(2, '0')
  const paddedDay = day.toString().padStart(2, '0')
  return `${year}-${paddedMonth}-${paddedDay}`
})

const formData = ref({
  companyDetails: {
    name: '',
    address: {
      line1: '',
      line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: '',
    },
    phone: '',
    tax_id: '',
  },
  individual: {
    phone: '',
    dob: {
      day: '',
      month: '',
      year: '',
    },
    relationship: {
      title: '',
    },
  },
  bankDetails: {
    account_number: '',
    routing_number: '',
    account_holder_name: '',
    account_holder_type: 'individual' as 'individual' | 'company',
  },
  businessProfile: {
    mcc: '4816', // Default to "Computer Network/Information Services"
    url: '',
    product_description: '',
  },
  tosAcceptance: {
    date: 0,
    service_agreement: 'full' as 'full' | 'recipient',
  },
  refreshUrl: `${window.location.origin}/refresh-stripe-account/${app.organization?.id}`,
  returnUrl: `${window.location.origin}`,
})

// Requirement name mappings
const requirementNames: Record<string, string> = {
  // Business Profile
  'business_profile.mcc': 'Business Category',
  'business_profile.url': 'Business Website',
  'business_profile.product_description': 'Product Description',

  // Individual Information
  'individual.dob.day': 'Date of Birth (Day)',
  'individual.dob.month': 'Date of Birth (Month)',
  'individual.dob.year': 'Date of Birth (Year)',
  'individual.phone': 'Phone Number',
  'individual.email': 'Email Address',
  'individual.first_name': 'First Name',
  'individual.last_name': 'Last Name',
  'individual.ssn_last_4': 'SSN Last 4 Digits',
  'individual.address.line1': 'Address Line 1',
  'individual.address.city': 'City',
  'individual.address.state': 'State',
  'individual.address.postal_code': 'Postal Code',
  'individual.relationship.title': 'Job Title',
  'individual.relationship.representative': 'Company Representative',
  'individual.relationship.executive': 'Company Executive',
  'individual.relationship.owner': 'Company Owner',
  'individual.relationship.percent_ownership': 'Ownership Percentage',

  // Terms of Service
  'tos_acceptance.date': 'Terms of Service Acceptance',
  'tos_acceptance.ip': 'Terms of Service IP Address',

  // Company Information
  'company.name': 'Company Name',
  'company.address.line1': 'Company Address',
  'company.address.city': 'Company City',
  'company.address.state': 'Company State',
  'company.address.postal_code': 'Company Postal Code',
  'company.phone': 'Company Phone',
  'company.tax_id': 'Company Tax ID',

  // Bank Account
  external_account: 'Bank Account Information',
  'external_account.account_number': 'Account Number',
  'external_account.routing_number': 'Routing Number',

  // Verification Documents
  'individual.verification.document': 'Identity Verification Document',
  'company.verification.document': 'Company Verification Document',
}

// Group requirements by category
function groupRequirements(
  requirements: string[],
): Record<string, { name: string; items: string[] }> {
  const groups: Record<string, { name: string; items: string[] }> = {}

  // Remove duplicates first
  const uniqueReqs = [...new Set(requirements)]

  uniqueReqs.forEach((req) => {
    let group = 'Other Information'
    const displayName = requirementNames[req] || formatRequirementFallback(req)

    // Determine group based on requirement prefix
    if (req.startsWith('individual.dob')) {
      group = 'Date of Birth'
    } else if (req.startsWith('individual.relationship')) {
      group = 'Role Information'
    } else if (req.startsWith('individual.')) {
      group = 'Personal Information'
    } else if (req.startsWith('business_profile.')) {
      group = 'Business Details'
    } else if (req.startsWith('company.')) {
      group = 'Company Information'
    } else if (req.startsWith('tos_acceptance.')) {
      group = 'Terms of Service'
    } else if (req.startsWith('external_account')) {
      group = 'Bank Account'
    }

    if (!groups[group]) {
      groups[group] = { name: group, items: [] }
    }
    groups[group].items.push(displayName)
  })

  return groups
}

// Fallback formatter for unknown requirements
function formatRequirementFallback(req: string) {
  return req
    .split('.')
    .map((part) =>
      part
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
    )
    .join(' - ')
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatAddress(address: {
  line_1?: string
  line_2?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
}) {
  if (!address) return ''
  const parts = [
    address.line_1,
    address.line_2,
    address.city,
    address.state,
    address.postal_code,
    address.country,
  ].filter(Boolean)
  return parts.join(', ')
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
    // Could add error handling/toast here if needed
  } finally {
    isRefreshing.value = false
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
    // Could add error handling/toast here if needed
  } finally {
    isDashboardLinkLoading.value = false
  }
}

// Handler for EditableField updates
function handleFieldUpdate(field: string, value: string) {
  // Clear validation error for this field when user updates it
  if (validationErrors.value[field]) {
    delete validationErrors.value[field]
  }

  switch (field) {
    case 'companyName':
      formData.value.companyDetails.name = value
      break
    case 'phone':
      formData.value.companyDetails.phone = value
      break
    case 'taxId':
      formData.value.companyDetails.tax_id = value
      break
    case 'individualPhone':
      formData.value.individual.phone = value
      break
    case 'jobTitle':
      formData.value.individual.relationship.title = value
      break
    case 'dob':
      // Parse the date string (YYYY-MM-DD) and store as separate values
      if (value) {
        const [year, month, day] = value.split('-')
        formData.value.individual.dob.year = year || ''
        formData.value.individual.dob.month = month ? month.replace(/^0+/, '') : '' // Remove leading zeros
        formData.value.individual.dob.day = day ? day.replace(/^0+/, '') : '' // Remove leading zeros
      } else {
        formData.value.individual.dob.year = ''
        formData.value.individual.dob.month = ''
        formData.value.individual.dob.day = ''
      }
      break
    case 'accountHolderName':
      formData.value.bankDetails.account_holder_name = value
      break
    case 'accountType':
      formData.value.bankDetails.account_holder_type = value as 'individual' | 'company'
      break
    case 'routingNumber':
      formData.value.bankDetails.routing_number = value
      break
    case 'accountNumber':
      formData.value.bankDetails.account_number = value
      break
    case 'websiteUrl':
      formData.value.businessProfile.url = value
      break
    case 'productDescription':
      formData.value.businessProfile.product_description = value
      break
  }
}

// Handler for AddressSearch updates
function handleAddressUpdate(field: string, address: { [key: string]: string | undefined }) {
  if (field === 'address') {
    // Clear address-related validation errors when user updates address
    delete validationErrors.value.address
    delete validationErrors.value.addressCity
    delete validationErrors.value.addressState
    delete validationErrors.value.addressPostal
    formData.value.companyDetails.address = {
      line1: address.line_1 ?? '',
      line2: address.line_2 ?? '',
      city: address.city ?? '',
      state: address.state ?? '',
      postal_code: address.postal_code ?? '',
      country: address.country ?? '',
    }
  }
}

function validateRequiredFields(): boolean {
  const errors: Record<string, string> = {}

  // Company Details validation
  if (!formData.value.companyDetails.name.trim()) {
    errors.companyName = 'Company name is required'
  }
  if (!formData.value.companyDetails.phone.trim()) {
    errors.phone = 'Phone number is required'
  }

  // Address validation
  if (!formData.value.companyDetails.address.line1.trim()) {
    errors.address = 'Business address is required'
  }
  if (!formData.value.companyDetails.address.city.trim()) {
    errors.addressCity = 'City is required'
  }
  if (!formData.value.companyDetails.address.state.trim()) {
    errors.addressState = 'State is required'
  }
  if (!formData.value.companyDetails.address.postal_code.trim()) {
    errors.addressPostal = 'Postal code is required'
  }

  // Personal Information validation
  if (!formData.value.individual.phone.trim()) {
    errors.individualPhone = 'Personal phone number is required'
  }
  if (!formData.value.individual.relationship.title.trim()) {
    errors.jobTitle = 'Job title is required'
  }
  if (
    !formData.value.individual.dob.month.trim() ||
    !formData.value.individual.dob.day.trim() ||
    !formData.value.individual.dob.year.trim()
  ) {
    errors.dob = 'Date of birth is required'
  }

  // Bank Details validation
  if (!formData.value.bankDetails.account_holder_name.trim()) {
    errors.accountHolderName = 'Account holder name is required'
  }
  if (!formData.value.bankDetails.routing_number.trim()) {
    errors.routingNumber = 'Routing number is required'
  }
  if (!formData.value.bankDetails.account_number.trim()) {
    errors.accountNumber = 'Account number is required'
  }

  // Additional validation for date of birth
  const month = parseInt(formData.value.individual.dob.month)
  const day = parseInt(formData.value.individual.dob.day)
  const year = parseInt(formData.value.individual.dob.year)

  if (month && (month < 1 || month > 12)) {
    errors.dob = 'Invalid date - month must be 1-12'
  }
  if (day && (day < 1 || day > 31)) {
    errors.dob = 'Invalid date - day must be 1-31'
  }
  if (year && (year < 1900 || year > new Date().getFullYear())) {
    errors.dob = 'Invalid date - year must be between 1900 and current year'
  }

  // Additional check for age (must be at least 18)
  if (year && month && day) {
    const birthDate = new Date(year, month - 1, day)
    const today = new Date()
    const age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    const dayDiff = today.getDate() - birthDate.getDate()

    if (age < 18 || (age === 18 && (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)))) {
      errors.dob = 'You must be at least 18 years old'
    }
  }

  validationErrors.value = errors
  return Object.keys(errors).length === 0
}

async function handleSubmit() {
  // Validate required fields first
  if (!validateRequiredFields()) {
    error.value = 'Please fill in all required fields'
    return
  }

  isSubmitting.value = true
  error.value = null
  validationErrors.value = {}

  try {
    // Set TOS acceptance date to current timestamp (in seconds)
    formData.value.tosAcceptance.date = Math.floor(Date.now() / 1000)

    // Get user's IP address (this will be captured server-side typically)
    // The IP should ideally be captured on the backend for security
    // but we'll pass a placeholder here

    // Create partial organization object with all the form data
    const partialOrg: Partial<Organization> & { id: string } = {
      id: app.organization?.id || '',
      name: formData.value.companyDetails.name,
      phone: formData.value.companyDetails.phone,
      email: app.organization?.email || user.value?.email,
      address: {
        line_1: formData.value.companyDetails.address.line1,
        line_2: formData.value.companyDetails.address.line2 || undefined,
        city: formData.value.companyDetails.address.city,
        state: formData.value.companyDetails.address.state,
        postal_code: formData.value.companyDetails.address.postal_code,
        country: formData.value.companyDetails.address.country,
      },
      tax_id: formData.value.companyDetails.tax_id || undefined,
      business_type:
        formData.value.bankDetails.account_holder_type === 'company' ? 'company' : 'individual',
      bank_account: {
        account_holder_name: formData.value.bankDetails.account_holder_name,
        account_holder_type: formData.value.bankDetails.account_holder_type,
        routing_number: formData.value.bankDetails.routing_number,
        // Store last 4 digits of account number for reference
        last4: formData.value.bankDetails.account_number.slice(-4),
        country: formData.value.companyDetails.address.country,
      },
      business_profile: {
        url: formData.value.businessProfile.url || undefined,
        product_description: formData.value.businessProfile.product_description || undefined,
        mcc: formData.value.businessProfile.mcc || undefined,
        support_phone: formData.value.companyDetails.phone,
        support_email: app.organization?.email || user.value?.email,
      },
    }

    // Store representative information (required for Stripe)
    if (user.value) {
      partialOrg.representative = {
        first_name: user.value.given_name,
        last_name: user.value.family_name,
        email: user.value.email,
        phone:
          formData.value.individual.phone ||
          user.value.phone_number ||
          formData.value.companyDetails.phone,
        dob: {
          day: parseInt(formData.value.individual.dob.day) || undefined,
          month: parseInt(formData.value.individual.dob.month) || undefined,
          year: parseInt(formData.value.individual.dob.year) || undefined,
        },
        relationship: {
          title: formData.value.individual.relationship.title,
          representative: true,
          executive: formData.value.bankDetails.account_holder_type === 'company',
          owner: formData.value.bankDetails.account_holder_type === 'individual',
        },
        address: user.value.address
          ? {
              line_1: user.value.address.line_1,
              line_2: user.value.address.line_2,
              city: user.value.address.city,
              state: user.value.address.state,
              postal_code: user.value.address.postal_code,
              country: user.value.address.country,
            }
          : {
              line_1: formData.value.companyDetails.address.line1,
              line_2: formData.value.companyDetails.address.line2 || undefined,
              city: formData.value.companyDetails.address.city,
              state: formData.value.companyDetails.address.state,
              postal_code: formData.value.companyDetails.address.postal_code,
              country: formData.value.companyDetails.address.country,
            },
      }
    }

    // First, update the organization in the database with all the form data
    try {
      const updatedOrg = await authAPI.updateOrganization(partialOrg)
      // Update local store with the updated organization
      if (app.organization) {
        Object.assign(app.organization, updatedOrg)
      }
    } catch (updateErr) {
      console.warn('Failed to update organization data, continuing with Stripe setup:', updateErr)
      // Continue with Stripe setup even if organization update fails
    }

    // Call the API to create connected account
    const response = await authAPI.createConnectedAccount(formData.value)

    if (response.onboarding_url) {
      // Update organization with Stripe response data
      const stripeUpdateData: Partial<Organization> & { id: string } = {
        id: app.organization?.id || '',
        stripe_account_id: response.account_id,
        onboarding_url: response.onboarding_url,
        onboarding_status: response.requires_onboarding ? 'in_progress' : 'completed',
        missing_requirements: response.missing_requirements,
        charges_enabled: response.charges_enabled,
        payouts_enabled: response.payouts_enabled,
      }

      // Update local store immediately
      if (app.organization) {
        Object.assign(app.organization, stripeUpdateData)
      }

      // Try to persist Stripe data to database
      try {
        await authAPI.updateOrganization(stripeUpdateData)
      } catch (updateErr) {
        console.warn('Failed to persist Stripe data to organization:', updateErr)
        // Continue anyway since Stripe account was created successfully
      }

      // Redirect to Stripe onboarding
      window.location.href = response.onboarding_url
    }
  } catch (err) {
    if (err && typeof err === 'object' && 'response' in err) {
      const axiosError = err as { response?: { data?: { message?: string } } }
      error.value =
        axiosError.response?.data?.message || 'Failed to create seller account. Please try again.'
    } else {
      error.value =
        err instanceof Error ? err.message : 'Failed to create seller account. Please try again.'
    }
    console.error('Error creating connected account:', err)
  } finally {
    isSubmitting.value = false
  }
}

// Pre-fill form with existing user data if available
onMounted(() => {
  if (organization.value && user.value) {
    // Pre-fill company name with organization's name
    if (organization.value.name) {
      formData.value.companyDetails.name = organization.value.name
    }
    if (organization.value.tax_id) {
      formData.value.companyDetails.tax_id = organization.value.tax_id
    }
    if (organization.value?.bank_account?.routing_number) {
      formData.value.bankDetails.routing_number = organization.value.bank_account.routing_number
    }
    if (organization.value?.business_profile?.url) {
      formData.value.businessProfile.url = organization.value.business_profile.url
    }

    // Pre-fill phone if available
    if (organization.value.phone) {
      formData.value.companyDetails.phone = organization.value.phone
    }

    // Pre-fill individual phone
    if (user.value.phone_number) {
      formData.value.individual.phone = user.value.phone_number
    }

    // Pre-fill address if available
    if (organization.value.address) {
      formData.value.companyDetails.address = {
        line1: organization?.value?.address?.line_1 ?? '',
        line2: organization?.value?.address?.line_2 ?? '',
        city: organization?.value?.address?.city ?? '',
        state: organization?.value?.address?.state ?? '',
        postal_code: organization?.value?.address?.postal_code ?? '',
        country: organization?.value?.address?.country ?? '',
      }
    }

    // Pre-fill account holder name
    formData.value.bankDetails.account_holder_name =
      user.value.name || `${user.value.given_name || ''} ${user.value.family_name || ''}`.trim()

    // Pre-fill from stored representative data if available
    if (organization.value.representative) {
      const rep = organization.value.representative
      if (rep.phone) formData.value.individual.phone = rep.phone
      if (rep.relationship?.title)
        formData.value.individual.relationship.title = rep.relationship.title
      if (rep.dob) {
        if (rep.dob.day) formData.value.individual.dob.day = rep.dob.day.toString()
        if (rep.dob.month) formData.value.individual.dob.month = rep.dob.month.toString()
        if (rep.dob.year) formData.value.individual.dob.year = rep.dob.year.toString()
      }
    }
  }
})
</script>

<style scoped>
.seller-manager {
  width: 100%;
  position: relative;
}

/* Loading Overlay */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  border-radius: var(--radius-lg);
}

[data-theme='dark'] .loading-overlay {
  background: var(--color-bg-primary);
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-8);
  text-align: center;
}

.loading-text {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.loading-subtext {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  max-width: 300px;
}

/* Status Section */
.status-section,
.onboarding-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.status-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.status-header h4 {
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* Vendor Account Card - Similar to PaymentMethodList design */
.vendor-account-card {
  border-radius: var(--radius-lg);
  background: var(--color-bg-primary);
  overflow: hidden;
  transition: all 0.2s ease;
}

.account-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: var(--space-5) var(--space-5) var(--space-4);
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

.account-id {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  font-family: var(--font-mono, 'Menlo', monospace);
}

.account-status {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
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
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--space-1);
  padding: var(--space-4) var(--space-5);
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

.business-details {
  padding: var(--space-4) var(--space-5) var(--space-5);
  border-top: 1px solid var(--color-border-light);
  background: var(--color-bg-muted);
}

.details-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border-light);
}

.details-row:last-child {
  border-bottom: none;
}

.detail-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  min-width: 80px;
}

.detail-value {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  text-align: right;
  flex: 1;
}

.detail-link {
  font-size: var(--font-size-sm);
  color: var(--color-primary);
  text-decoration: none;
  text-align: right;
  flex: 1;
}

.detail-link:hover {
  text-decoration: underline;
}

/* Progress Card */
.progress-card {
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  background: var(--color-bg-primary);
  transition: all 0.2s ease;
}

.progress-header {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.progress-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg);
  background: rgba(59, 130, 246, 0.1);
  color: rgb(59, 130, 246);
  flex-shrink: 0;
}

.progress-info h5 {
  margin: 0 0 var(--space-1) 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.progress-info p {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  width: fit-content;
}

.status-not-started {
  background: var(--color-bg-muted);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}

.status-completed {
  background: rgba(34, 197, 94, 0.1);
  color: rgb(34, 197, 94);
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.status-action,
.status-requires-action {
  background: rgba(239, 68, 68, 0.1);
  color: rgb(239, 68, 68);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.status-progress,
.status-in-progress {
  background: rgba(59, 130, 246, 0.1);
  color: rgb(59, 130, 246);
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.summary-info {
  display: flex;
  gap: var(--space-4);
  font-size: var(--font-size-sm);
}

.info-item {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.info-label {
  color: var(--color-text-secondary);
}

.info-value {
  font-weight: var(--font-weight-medium);
}

.info-value.enabled {
  color: rgb(34, 197, 94);
}

.info-value.disabled {
  color: var(--color-text-secondary);
}

.stripe-link {
  color: var(--color-primary);
  text-decoration: none;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  transition: opacity 0.2s ease;
  width: fit-content;
}

.stripe-link:hover {
  opacity: 0.8;
}

/* Expanded-only content */
.capabilities {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-3);
  background: var(--color-bg-muted);
  border-radius: var(--radius-md);
  margin-top: var(--space-3);
}

.capability-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
}

.check-icon {
  color: rgb(34, 197, 94);
}

.x-icon {
  color: rgb(239, 68, 68);
}

.requirements-section {
  margin-top: var(--space-3);
}

.requirements-section h5 {
  margin: 0 0 var(--space-3) 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.requirement-group {
  margin-bottom: var(--space-4);
}

.requirement-group:last-child {
  margin-bottom: 0;
}

.requirement-group-title {
  margin: 0 0 var(--space-2) 0;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  padding-left: var(--space-1);
}

.requirements-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.requirements-list li {
  padding: var(--space-2) var(--space-3);
  background: rgba(239, 68, 68, 0.05);
  border-left: 3px solid rgb(239, 68, 68);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

.action-section {
  padding-top: var(--space-2);
}

.completion-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--color-bg-muted);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  margin-top: var(--space-3);
}

.completion-label {
  color: var(--color-text-secondary);
}

.completion-date {
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
}

/* Onboarding Section */
.setup-prompt {
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  background: var(--color-bg-primary);
  transition: all 0.2s ease;
}

.prompt-header {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.prompt-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg);
  background: rgba(34, 197, 94, 0.1);
  color: rgb(34, 197, 94);
  flex-shrink: 0;
}

.prompt-info {
  flex: 1;
  min-width: 0;
}

.prompt-info h5 {
  margin: 0 0 var(--space-1) 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.prompt-info p {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.4;
}

.expand-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.setup-prompt:hover .expand-hint {
  background: var(--color-primary-alpha);
  color: var(--color-primary);
  transform: translateY(2px);
}

.cta-section {
  padding-top: var(--space-2);
}

/* Terms of Service Notice */
.tos-notice {
  padding: var(--space-3);
  background: var(--color-bg-muted);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.tos-text {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.tos-link {
  color: var(--color-primary);
  text-decoration: none;
  font-weight: var(--font-weight-medium);
}

.tos-link:hover {
  text-decoration: underline;
}

/* Responsive */
@media (max-width: 640px) {
  .summary-info {
    flex-direction: column;
    gap: var(--space-2);
  }

  .capabilities {
    flex-direction: column;
  }

  .account-header {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-3);
  }

  .account-status {
    align-items: flex-start;
  }

  .progress-actions {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2);
  }

  .capabilities-grid {
    grid-template-columns: 1fr;
    gap: var(--space-3);
  }

  .capability-card {
    padding: var(--space-3);
  }

  .details-row {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-1);
  }

  .detail-label {
    min-width: unset;
  }

  .detail-value,
  .detail-link {
    text-align: left;
  }

  .progress-header {
    flex-direction: column;
    gap: var(--space-3);
  }

  .progress-icon {
    align-self: flex-start;
  }

  .prompt-header {
    flex-direction: column;
    gap: var(--space-3);
  }

  .prompt-icon {
    align-self: flex-start;
  }

  .prompt-info h5 {
    font-size: var(--font-size-lg);
  }

  .expand-hint {
    align-self: center;
  }
}
.progress-note {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  line-height: 1.5;
}
.dashboard-button {
  margin-left: auto;
  margin-right: auto;
}

/* Requirements Badge */
.requirements-badge {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: rgba(239, 68, 68, 0.1);
  color: rgb(239, 68, 68);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  flex-shrink: 0;
}

.requirements-badge span {
  line-height: 1;
}

/* Progress Actions */
.progress-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

/* Refresh Button */
.refresh-button {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

/* Account Status adjustments */
.account-status {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-2);
}
</style>
