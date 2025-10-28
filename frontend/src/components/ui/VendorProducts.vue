<template>
  <div v-if="expanded" class="product-creator">
    <!-- Expanded: Grid or Form -->
    <div v-if="!showForm" class="products-grid-view">
      <div class="product-grid-header">
        <BaseButton @click="startNew" variant="primary" size="sm">+ New Product</BaseButton>
      </div>

      <div v-if="productsLoading || isRefreshing" class="loading-container">
        <LoadingSpinner size="32" />
        <span style="margin-top: 8px; font-size: 14px; color: var(--color-text-secondary)">
          Updating products...
        </span>
      </div>

      <ProductsList
        v-else-if="!productsLoading && products.length > 0"
        :products="products"
        :purchasable="false"
        :shareable="true"
        :editable="true"
        variant="grid"
        @click="handleEdit"
      />
    </div>

    <form v-else @submit.prevent="handleSubmit" class="onboarding-form">
      <!-- Error Message -->
      <div v-if="app.productFormData.error" class="error-message">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" class="error-icon">
          <path
            fill-rule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            clip-rule="evenodd"
          />
        </svg>
        <div class="error-content">
          <h4 class="error-title">Product Error</h4>
          <p class="error-text">{{ app.productFormData.error }}</p>
        </div>
      </div>
      <div class="form-section">
        <div class="form-grid">
          <div class="form-field full-width">
            <EditableSelect
              field="productType"
              label="Type"
              :options="productTypeOptions"
              :value="app.productFormData.type"
              @update="handleFieldUpdate"
            />
          </div>
        </div>
      </div>
      <div v-if="app.productFormData.type === 'one_time'" class="form-section">
        <div class="form-grid">
          <div class="form-field">
            <EditableField
              field="name"
              type="text"
              label="Name"
              :value="app.productFormData.name"
              :error="validationErrors.name"
              @update="handleFieldUpdate"
            />
          </div>
          <div class="form-field">
            <EditableSelect
              field="category"
              label="Category"
              :options="categoryOptions"
              :value="app.productFormData.category"
              :error="validationErrors.category"
              searchable
              @update="handleFieldUpdate"
            />
          </div>
          <div class="form-field">
            <EditableField
              field="price"
              type="text"
              :label="`Price (${new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: app.organization?.currency,
              }).format(app.productFormData.price)})`"
              :value="app.productFormData.price.toString()"
              :error="validationErrors.price"
              @update="handleFieldUpdate"
            />
          </div>
          <div class="form-field full-width">
            <EditableField
              field="description"
              type="textarea"
              label="Description"
              :value="app.productFormData.description"
              :error="validationErrors.description"
              @update="handleFieldUpdate"
            />
          </div>
        </div>
      </div>
      <div v-if="app.productFormData.type === 'recurring'" class="form-section">
        <div class="form-grid">
          <div class="form-field">
            <EditableField
              field="name"
              type="text"
              label="Name"
              :value="app.productFormData.name"
              :error="validationErrors.name"
              @update="handleFieldUpdate"
            />
          </div>
          <div class="form-field">
            <EditableSelect
              field="category"
              label="Category"
              :options="categoryOptions"
              :value="app.productFormData.category"
              :error="validationErrors.category"
              @update="handleFieldUpdate"
            />
          </div>
          <div class="form-field">
            <EditableSelect
              field="usageType"
              label="Usage Type"
              :options="usageTypeOptions"
              :value="app.productFormData.usageType"
              :error="validationErrors.usageType"
              @update="handleFieldUpdate"
            />
          </div>
          <div class="form-field">
            <EditableSelect
              field="billingInterval"
              label="Billing Interval"
              :options="billingIntervalOptions"
              :value="app.productFormData.billingPeriod.interval"
              :error="validationErrors.billingInterval"
              @update="handleFieldUpdate"
            />
          </div>
          <div class="form-field">
            <EditableField
              field="billingIntervalCount"
              type="text"
              :label="`Every ${app.productFormData.billingPeriod.intervalCount} ${app.productFormData.billingPeriod.interval}${app.productFormData.billingPeriod.intervalCount > 1 ? 's' : ''}`"
              :value="app.productFormData.billingPeriod.intervalCount.toString()"
              :error="validationErrors.billingIntervalCount"
              @update="handleFieldUpdate"
            />
          </div>
          <div class="form-field full-width">
            <EditableField
              field="description"
              type="textarea"
              label="Description"
              :value="app.productFormData.description"
              :error="validationErrors.description"
              @update="handleFieldUpdate"
            />
          </div>
        </div>
      </div>
      <div
        v-if="
          app.productFormData.type === 'recurring' && app.productFormData.usageType === 'licensed'
        "
        class="form-section"
      >
        <div class="form-grid">
          <div class="form-field">
            <EditableField
              field="price"
              type="text"
              :label="`Price per ${app.productFormData.billingPeriod.intervalCount > 1 ? `${app.productFormData.billingPeriod.intervalCount} ${app.productFormData.billingPeriod.interval}s` : app.productFormData.billingPeriod.interval} (${new Intl.NumberFormat(
                'en-US',
                {
                  style: 'currency',
                  currency: app.organization?.currency,
                },
              ).format(app.productFormData.price)})`"
              :value="app.productFormData.price.toString()"
              :error="validationErrors.price"
              @update="handleFieldUpdate"
            />
          </div>
        </div>
      </div>
      <div
        v-if="
          app.productFormData.type === 'recurring' &&
          app.productFormData.usageType === 'metered' &&
          !app.productFormData.key
        "
        class="form-section"
      >
        <h3>Meter Configuration</h3>
        <div class="form-grid">
          <div class="form-field">
            <EditableField
              field="meterDisplayName"
              type="text"
              label="Meter Display Name"
              :value="app.productFormData.meterConfig.displayName"
              :error="validationErrors.meterDisplayName"
              @update="handleFieldUpdate"
            />
          </div>
          <div class="form-field">
            <EditableField
              field="meterUnit"
              type="text"
              label="Unit (e.g., MB, 100 Tokens, image)"
              placeholder="e.g., MB, 100 Tokens, image"
              :value="app.productFormData.meterConfig.unit"
              :error="validationErrors.meterUnit"
              @update="handleFieldUpdate"
            />
          </div>
          <div class="form-field">
            <EditableSelect
              field="meterAggregationFormula"
              label="Aggregation Formula"
              :options="aggregationFormulaOptions"
              :value="app.productFormData.meterConfig.aggregationFormula"
              :error="validationErrors.meterAggregationFormula"
              @update="handleFieldUpdate"
            />
          </div>
          <div class="form-field">
            <EditableField
              field="price"
              type="text"
              :label="`Price per unit (${new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: app.organization?.currency,
              }).format(app.productFormData.price)})`"
              :value="app.productFormData.price.toString()"
              :error="validationErrors.price"
              @update="handleFieldUpdate"
            />
          </div>
        </div>
      </div>
      <div
        v-if="
          app.productFormData.type === 'recurring' &&
          app.productFormData.usageType === 'metered' &&
          app.productFormData.key
        "
        class="form-section"
      >
        <div class="form-grid">
          <div class="form-field">
            <EditableField
              field="price"
              type="text"
              :label="`Price per unit (${new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: app.organization?.currency,
              }).format(app.productFormData.price)})`"
              :value="app.productFormData.price.toString()"
              :error="validationErrors.price"
              @update="handleFieldUpdate"
            />
          </div>
        </div>
      </div>

      <div v-if="app.productFormData.type" class="form-grid">
        <EditableToggle
          label="Publicly Visible"
          :value="app.productFormData.is_public"
          @update="app.updateProductFormField('is_public', !app.productFormData.is_public)"
          field="is_public"
          onLabel=""
          offLabel=""
        />
        <EditableToggle
          label="Requires Shipping"
          :value="app.productFormToggleStates.requiresShipping"
          @update="
            app.setProductFormToggleState(
              'requiresShipping',
              !app.productFormToggleStates.requiresShipping,
            )
          "
          field="requiresShipping"
          onLabel=""
          offLabel=""
        />
        <EditableToggle
          label="Images"
          :value="app.productFormToggleStates.showImages"
          @update="
            app.setProductFormToggleState('showImages', !app.productFormToggleStates.showImages)
          "
          field="showImages"
          onLabel=""
          offLabel=""
        />
        <EditableToggle
          label="Marketing Features"
          :value="app.productFormToggleStates.showMarketingFeatures"
          @update="
            app.setProductFormToggleState(
              'showMarketingFeatures',
              !app.productFormToggleStates.showMarketingFeatures,
            )
          "
          field="showMarketingFeatures"
          onLabel=""
          offLabel=""
        />
        <EditableToggle
          label="Limited Quantity"
          :value="app.productFormToggleStates.limitedQuantity"
          @update="
            app.setProductFormToggleState(
              'limitedQuantity',
              !app.productFormToggleStates.limitedQuantity,
            )
          "
          field="limitedQuantity"
          onLabel=""
          offLabel=""
        />
      </div>

      <!-- Images Section -->
      <div v-if="app.productFormToggleStates.showImages" class="form-section">
        <ImageUploader
          v-model="app.productFormData.images"
          :on-upload="handleImageUpload"
          @update:modelValue="
            (newImages: string[]) => {
              app.productFormData.images = newImages
            }
          "
        />
      </div>

      <!-- Marketing Features Section -->
      <div v-if="app.productFormToggleStates.showMarketingFeatures" class="form-section">
        <StringListEditor
          v-model="marketingFeaturesStrings"
          add-button-text="Add Marketing Feature"
        />
      </div>
      <div v-if="app.productFormToggleStates.limitedQuantity" class="form-section">
        <div class="form-grid">
          <div class="form-field">
            <label class="field-label">Quantity Available</label>
            <QuantitySelector
              v-model="quantityModel"
              :min="0"
              :max="9999"
              size="md"
            />
            <span v-if="validationErrors.quantity" class="field-error">{{
              validationErrors.quantity
            }}</span>
          </div>
          <div class="form-field">
            <label class="field-label">Per Customer Limit</label>
            <QuantitySelector
              v-model="quantityLimitModel"
              :min="1"
              :max="quantityModel"
              size="md"
            />
            <span v-if="validationErrors.quantityLimit" class="field-error">{{
              validationErrors.quantityLimit
            }}</span>
          </div>
        </div>
      </div>
    </form>
    <div
      v-if="submitMessage"
      class="submit-feedback"
      :class="{ success: submitSuccess, error: !submitSuccess }"
    >
      {{ submitMessage }}
    </div>
    <div v-if="app.productFormData.type" class="footer">
      <BaseButton variant="outline" size="sm" @click.prevent="onCancel">Cancel</BaseButton>
      <BaseButton
        @click="handleSubmit"
        :disabled="isSubmitting || !isFormValid"
        :loading="isSubmitting"
      >
        <span v-if="!isSubmitting">{{ app.productFormData.key ? 'Update' : 'Submit' }}</span>
        <span v-else>{{
          app.productFormData.type === 'recurring' &&
          app.productFormData.usageType === 'metered' &&
          !app.productFormData.key
            ? 'Creating meter and product...'
            : app.productFormData.key
              ? 'Updating product...'
              : 'Creating product...'
        }}</span>
      </BaseButton>
    </div>
  </div>
  <div v-else class="product-creator-collapsed">
    <div v-if="productsLoading || isRefreshing" class="loading-container">
      <LoadingSpinner size="32" />
      <span
        v-if="isRefreshing"
        style="margin-top: 8px; font-size: 14px; color: var(--color-text-secondary)"
        >Updating products...</span
      >
    </div>
    <div v-else-if="!productsLoading && products.length > 0" class="products-section">
      <ProductsList
        :products="products"
        :purchasable="false"
        :shareable="true"
        @click="handleEdit"
      />
    </div>
    <div v-else class="empty-state">
      <div class="empty-state-content">
        <h3 class="empty-state-title">Get started with your first product!</h3>
        <BaseButton @click="handleEdit()" variant="primary" size="lg" class="empty-state-cta">
          Create your first product
        </BaseButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  apiClient,
  authAPI
} from '@/services/api'
import { useAppStore } from '@/stores/app'
import { domain, taxCodes } from '@marketplace/constants'
import type { CreatePresignedUploadUrlRequest, Product, UpdateRequest } from '@marketplace/types'
import { v4 } from 'uuid'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import BaseButton from './BaseButton.vue'
import EditableField from './EditableField.vue'
import EditableSelect from './EditableSelect.vue'
import EditableToggle from './EditableToggle.vue'
import ImageUploader from './ImageUploader.vue'
import LoadingSpinner from './LoadingSpinner.vue'
import ProductsList from './ProductsList.vue'
import QuantitySelector from './QuantitySelector.vue'
import StringListEditor from './StringListEditor.vue'

const app = useAppStore()
// Define props
interface Props {
  expanded?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  expanded: false,
})

const emit = defineEmits(['edit', 'close'])

// Local UI state to toggle grid vs form within expanded mode
// Show form if we have a product key (editing) or a type set (creating new)
const showForm = computed(() => !!app.productFormData.key || !!app.productFormData.type)

const productTypeOptions = ref([
  { value: 'one_time', label: 'One Time' },
  { value: 'recurring', label: 'Recurring' },
])

const usageTypeOptions = ref([
  { value: 'licensed', label: 'Licensed (Fixed Recurring)' },
  { value: 'metered', label: 'Metered (Usage-based)' },
])

const aggregationFormulaOptions = ref([
  { value: 'count', label: 'Count (Total Events)' },
  { value: 'sum', label: 'Sum (Total Value)' },
])

const billingIntervalOptions = ref([
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
])

// Use organization products from the store instead of local state
const products = computed(() => app.organizationProducts)
const productsLoading = computed(() => app.organizationProductsLoading)

const categoryOptions = ref(taxCodes)

const isRefreshing = ref(false)
const isSubmitting = ref(false)
const submitMessage = ref('')
const submitSuccess = ref(false)

const validationErrors = ref<Record<string, string>>({})

// Computed property to convert marketing features to/from strings
const marketingFeaturesStrings = computed({
  get: () => app.productFormData.marketingFeatures.map((f) => f.name),
  set: (value: string[]) => {
    app.productFormData.marketingFeatures = value.map((name) => ({ name }))
  },
})

// Computed properties for quantity fields
const quantityLimitModel = computed({
  get: () => app.productFormData.quantity_limit ?? quantityModel.value,
  set: (value: number) => {
    app.updateProductFormField('quantity_limit', value)
    // Clear validation error when value changes
    if (validationErrors.value.quantityLimit) {
      delete validationErrors.value.quantityLimit
    }
  },
})

const quantityModel = computed({
  get: () => app.productFormData.quantity || 0,
  set: (value: number) => {
    app.updateProductFormField('quantity', value)
    // Clear validation error when value changes
    if (validationErrors.value.quantity) {
      delete validationErrors.value.quantity
    }
  },
})

// Function to generate event name from unit field
const generateEventName = (unit: string): string => {
  // Remove all special characters and replace spaces with hyphens
  const sanitized = unit
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens

  return `${v4()}-${sanitized}-used`
}

// Computed property to check if form is valid and ready for submission
const isFormValid = computed(() => {
  // Check basic required fields
  if (!app.productFormData.name) return false
  if (!app.productFormData.category) return false
  if (!app.productFormData.description) return false

  // Validate pricing for one-time and licensed recurring products
  if (
    app.productFormData.type === 'one_time' ||
    (app.productFormData.type === 'recurring' && app.productFormData.usageType === 'licensed')
  ) {
    if (!app.productFormData.price || app.productFormData.price <= 0) return false
  }

  // Validate billing period for recurring products
  if (app.productFormData.type === 'recurring') {
    if (!app.productFormData.billingPeriod.interval) return false
    if (
      !app.productFormData.billingPeriod.intervalCount ||
      app.productFormData.billingPeriod.intervalCount < 1
    )
      return false
  }

  // Validate meter configuration for NEW metered recurring products only
  if (
    app.productFormData.type === 'recurring' &&
    app.productFormData.usageType === 'metered' &&
    !app.productFormData.key
  ) {
    if (!app.productFormData.meterConfig.displayName) return false
    if (!app.productFormData.meterConfig.unit) return false
    if (!app.productFormData.meterConfig.aggregationFormula) return false
    if (!app.productFormData.price || app.productFormData.price <= 0) return false
  }

  // For existing metered products, only validate price
  if (
    app.productFormData.type === 'recurring' &&
    app.productFormData.usageType === 'metered' &&
    app.productFormData.key
  ) {
    if (!app.productFormData.price || app.productFormData.price <= 0) return false
  }

  // Check if there are any validation errors
  if (Object.keys(validationErrors.value).length > 0) return false

  return true
})

const fetchOrganizationProducts = async () => {
  await app.fetchOrganizationProducts()
}

const handleEdit = (product?: Product) => {
  if (product) {
    const isRecurring = !!product.default_price_data.recurring
    const recurring = product.default_price_data.recurring

    app.setProductFormData({
      type: isRecurring ? 'recurring' : 'one_time',
      name: product.name,
      description: product.description,
      category: product.tax_code ?? '',
      price: product.default_price_data.unit_amount / 100,
      is_public: product.is_public,
      usageType: recurring?.usage_type || 'licensed',
      billingPeriod: {
        interval: recurring?.interval || 'month',
        intervalCount: recurring?.interval_count || 1,
      },
      meterConfig: {
        displayName: product.metadata?.meter_unit || '',
        unit: product.default_price_data.unit_label || '',
        eventName: product.default_price_data.meter_event || '',
        aggregationFormula: 'count',
      },
      key: {
        group_id: product.group_id,
        id: product.id,
      },
      images: product.images || [],
      marketingFeatures: product.marketing_features || [],
      error: product.error,
    })

    // Set toggle states in store so they persist across component recreation
    app.setProductFormToggleState(
      'showImages',
      Boolean(product.images && product.images.length > 0),
    )
    app.setProductFormToggleState(
      'showMarketingFeatures',
      Boolean(product.marketing_features && product.marketing_features.length > 0),
    )
    app.setProductFormToggleState(
      'requiresShipping',
      Boolean(product.metadata?.shipping_required === 'true'),
    )
  } else {
    // Clear form for new product
    app.setProductFormData({
      type: 'one_time',
      name: '',
      description: '',
      category: '',
      price: 0,
      is_public: false,
    })
  }

  // Only emit to parent if we're in collapsed mode (to trigger expansion)
  // When already expanded, we just switch from grid to form internally
  if (!props.expanded) {
    emit('edit', product)
  }
}

// Start a new product creation: clear form and show the form view
const startNew = () => {
  app.setProductFormData({
    type: 'one_time',
    name: '',
    description: '',
    category: '',
    price: 0,
  })
}

// Cancel editing/creation and return to grid
const onCancel = () => {
  app.clearProductFormData()
}

const handleFieldUpdate = (field: string, value: string) => {
  // Clear validation error for this field when user updates it
  if (validationErrors.value[field]) {
    delete validationErrors.value[field]
  }

  switch (field) {
    case 'productType':
      app.updateProductFormField('type', value)
      // Reset usage type when product type changes
      if (value === 'recurring') {
        app.updateProductFormField('usageType', 'licensed')
      }
      break
    case 'name':
      app.updateProductFormField('name', value)
      break
    case 'category':
      app.updateProductFormField('category', value)
      break
    case 'description':
      app.updateProductFormField('description', value)
      break
    case 'usageType':
      app.updateProductFormField('usageType', value)
      break
    case 'billingInterval':
      app.productFormData.billingPeriod.interval = value as 'day' | 'week' | 'month' | 'year'
      break
    case 'billingIntervalCount':
      if (isNaN(Number(value)) || Number(value) < 1) {
        validationErrors.value.billingIntervalCount = 'Invalid interval count'
      } else {
        app.productFormData.billingPeriod.intervalCount = Number(value)
      }
      break
    case 'price':
      if (isNaN(Number(value))) {
        validationErrors.value.price = 'Invalid price'
      } else {
        app.updateProductFormField('price', Number(Number(value).toFixed(2)))
      }
      break
    case 'meterDisplayName':
      app.productFormData.meterConfig.displayName = value
      break
    case 'meterUnit':
      app.productFormData.meterConfig.unit = value
      // Auto-generate event name from unit
      app.productFormData.meterConfig.eventName = generateEventName(value)
      break
    case 'meterAggregationFormula':
      app.productFormData.meterConfig.aggregationFormula = value as 'count' | 'sum'
      break
  }
}

const handleImageUpload = async (files: FileList) => {
  try {
    // Construct IMAGE_URL the same way as api.ts and ImageUploader.vue
    const IMAGE_URL = `https://images.${domain}`

    for (const file of Array.from(files)) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        continue
      }

      // Create unique filename
      const filename = `${Date.now()}-${file.name}`

      // Get presigned URL
      const uploadData: CreatePresignedUploadUrlRequest = {
        filename,
        contentType: file.type,
      }

      const { uploadUrl, key } = await authAPI.createPresignedUploadUrl(uploadData)

      // Upload to S3
      await authAPI.uploadImageToS3(uploadUrl, file)

      // Store the full URL (matching how ImageUploader checks for http URLs)
      const imageUrl = `${IMAGE_URL}/${key}`
      app.productFormData.images.push(imageUrl)
    }
  } catch (error) {
    console.error('Error uploading images:', error)
  }
}

const handleSubmit = async () => {
  if (isSubmitting.value) return // Prevent double submission

  try {
    // Clear previous messages
    submitMessage.value = ''
    submitSuccess.value = false
    isSubmitting.value = true

    // Validate required fields
    const errors: Record<string, string> = {}
    if (!app.productFormData.name) errors.name = 'Product name is required'
    if (!app.productFormData.category) errors.category = 'Category is required'
    if (!app.productFormData.description) errors.description = 'Description is required'

    // Validate pricing for one-time and licensed recurring products
    if (
      app.productFormData.type === 'one_time' ||
      (app.productFormData.type === 'recurring' && app.productFormData.usageType === 'licensed')
    ) {
      if (!app.productFormData.price || app.productFormData.price <= 0)
        errors.price = 'Valid price is required'
    }

    // Validate billing period for recurring products
    if (app.productFormData.type === 'recurring') {
      if (!app.productFormData.billingPeriod.interval)
        errors.billingInterval = 'Billing interval is required'
      if (
        !app.productFormData.billingPeriod.intervalCount ||
        app.productFormData.billingPeriod.intervalCount < 1
      )
        errors.billingIntervalCount = 'Valid interval count is required'
    }

    // Validate meter configuration for NEW metered recurring products only
    if (
      app.productFormData.type === 'recurring' &&
      app.productFormData.usageType === 'metered' &&
      !app.productFormData.key
    ) {
      if (!app.productFormData.meterConfig.displayName)
        errors.meterDisplayName = 'Meter display name is required'
      if (!app.productFormData.meterConfig.unit) errors.meterUnit = 'Unit is required'
      if (!app.productFormData.meterConfig.aggregationFormula)
        errors.meterAggregationFormula = 'Aggregation formula is required'
      if (!app.productFormData.price || app.productFormData.price <= 0)
        errors.price = 'Valid price per unit is required'
    }

    // For existing metered products, only validate price
    if (
      app.productFormData.type === 'recurring' &&
      app.productFormData.usageType === 'metered' &&
      app.productFormData.key
    ) {
      if (!app.productFormData.price || app.productFormData.price <= 0)
        errors.price = 'Valid price per unit is required'
    }

    if (Object.keys(errors).length > 0) {
      validationErrors.value = errors
      isSubmitting.value = false
      return
    }

    let meterId: string | undefined

    // For existing metered products, get the existing meter ID
    if (
      app.productFormData.type === 'recurring' &&
      app.productFormData.usageType === 'metered' &&
      app.productFormData.key
    ) {
      // Find the existing product to get its meter ID
      const existingProduct = products.value.find(
        (p) =>
          p.group_id === app.productFormData.key?.group_id && p.id === app.productFormData.key?.id,
      )
      meterId = existingProduct?.default_price_data.meter
    }

    // Create meter if this is a NEW metered recurring product
    if (
      app.productFormData.type === 'recurring' &&
      app.productFormData.usageType === 'metered' &&
      !app.productFormData.key
    ) {
      try {
        const meterResponse = await authAPI.createMeter({
          display_name: app.productFormData.meterConfig.displayName,
          event_name: app.productFormData.meterConfig.eventName,
          default_aggregation: {
            formula: app.productFormData.meterConfig.aggregationFormula,
          },
        })
        meterId = meterResponse.meter.id
      } catch (error) {
        console.error('Error creating meter:', error)
        // Handle meter creation error
        submitMessage.value = 'Failed to create meter. Please try again.'
        submitSuccess.value = false
        isSubmitting.value = false
        return
      }
    }

    // Build default_price_data based on product type
    const defaultPriceData: {
      currency: string
      tax_behavior: 'exclusive'
      unit_amount?: number
      recurring?: {
        interval: 'day' | 'week' | 'month' | 'year'
        interval_count: number
        usage_type: 'licensed' | 'metered'
      }
      meter?: string
      meter_event?: string // Event name for usage-based pricing
      unit_label?: string // Unit label for metered products
    } = {
      currency: app.organization?.currency || 'usd',
      tax_behavior: 'exclusive' as const,
    }

    if (app.productFormData.type === 'one_time') {
      // One-time product
      defaultPriceData.unit_amount = Math.round(app.productFormData.price * 100) // Convert to cents
    } else if (app.productFormData.type === 'recurring') {
      // Recurring product
      defaultPriceData.recurring = {
        interval: app.productFormData.billingPeriod.interval,
        interval_count: app.productFormData.billingPeriod.intervalCount,
        usage_type: app.productFormData.usageType,
      }

      if (app.productFormData.usageType === 'licensed') {
        // Licensed recurring - fixed monthly price
        defaultPriceData.unit_amount = Math.round(app.productFormData.price * 100) // Convert to cents
      } else if (app.productFormData.usageType === 'metered') {
        // Metered recurring - usage-based pricing
        if (meterId) {
          defaultPriceData.meter = meterId
        }
        // Preserve existing meter_event and unit_label when editing
        if (app.productFormData.meterConfig.eventName) {
          defaultPriceData.meter_event = app.productFormData.meterConfig.eventName
        }
        if (app.productFormData.meterConfig.unit) {
          defaultPriceData.unit_label = app.productFormData.meterConfig.unit
        }
        // Set the price per unit that will be multiplied by meter usage
        defaultPriceData.unit_amount = Math.round(app.productFormData.price * 100) // Convert to cents
      }
    }

    // Get existing product metadata if editing
    const existingProduct = app.productFormData.key
      ? products.value.find(
          (p) =>
            p.group_id === app.productFormData.key?.group_id &&
            p.id === app.productFormData.key?.id,
        )
      : undefined

    // Build product object matching API Product interface
    const product: UpdateRequest<Product> = {
      group_id: `${app.user?.organization_id}.${app.productFormData.category}`,
      id: v4(),
      organization_id: app.user?.organization_id || '',
      is_public: app.productFormData.is_public,
      name: app.productFormData.name,
      description: app.productFormData.description,
      active: true,
      tax_code: app.productFormData.category,
      default_price_data: {
        ...defaultPriceData,
        unit_amount: defaultPriceData.unit_amount ?? 0,
      },
      persist_update: true,
      account_id: app.organization?.stripe_account_id || '',
      images: app.productFormData.images.length > 0 ? app.productFormData.images : [],
      marketing_features:
        app.productFormData.marketingFeatures.length > 0
          ? app.productFormData.marketingFeatures.filter(
              (f) => f?.name != null && f.name.trim() !== '',
            )
          : [],
      // Preserve existing metadata when editing
      metadata: existingProduct?.metadata ? { ...existingProduct.metadata } : {},
    }
    if (app.productFormToggleStates.requiresShipping) {
      if (!product.metadata || typeof product.metadata === 'string') {
        product.metadata = {}
      }
      product.metadata.shipping_required = 'true'
    } else {
      // Remove shipping_required if toggle is off
      if (product.metadata && typeof product.metadata !== 'string' && product.metadata.shipping_required) {
        delete product.metadata.shipping_required
      }
    }
    // Store meter unit in metadata for metered products
    if (
      app.productFormData.type === 'recurring' &&
      app.productFormData.usageType === 'metered' &&
      app.productFormData.meterConfig.unit
    ) {
      if (!product.metadata || typeof product.metadata === 'string') {
        product.metadata = {}
      }
      product.metadata.meter_unit = app.productFormData.meterConfig.unit
    }

    // Handle quantity fields - if toggle is off, set to empty strings to remove from DB
    if (!app.productFormToggleStates.limitedQuantity) {
      product.quantity = ''
      product.quantity_limit = ''
    } else {
      // Only include quantity fields if toggle is on
      if (app.productFormData.quantity != null) {
        product.quantity = app.productFormData.quantity
      }
      if (app.productFormData.quantity_limit != null) {
        product.quantity_limit = app.productFormData.quantity_limit
      }
    }

    if (app.productFormData.key) {
      product.id = app.productFormData.key.id
      product.group_id = app.productFormData.key.group_id
      await apiClient.put(
        `/products/${app.productFormData.key.group_id}/${app.productFormData.key.id}`,
        product,
      )
    } else {
      await apiClient.post('/products', product)
    }
    submitSuccess.value = true

    // Reset form on success
    app.clearProductFormData()
    validationErrors.value = {}

    // Refresh the product list to show the new/updated product
    isRefreshing.value = true
    try {
      await fetchOrganizationProducts()
    } finally {
      isRefreshing.value = false
    }

    // close modal
    emit('close')

    // Clear success message after 3 seconds
    setTimeout(async () => {
      submitMessage.value = ''
      await fetchOrganizationProducts()
    }, 3000)
  } catch (error) {
    console.error('Error creating/updating product:', error)
    submitMessage.value = app.productFormData.key
      ? 'Failed to update product. Please try again.'
      : 'Failed to create product. Please try again.'
    submitSuccess.value = false
  } finally {
    isSubmitting.value = false
  }
}
onMounted(() => {
  // Only fetch if we don't have products loaded yet
  if (products.value.length === 0 && !productsLoading.value) {
    fetchOrganizationProducts()
  }
})

// Clear form data when component unmounts (which happens when modal closes)
onUnmounted(() => {
  if (props.expanded) {
    app.clearProductFormData()
  }
})
</script>
<style scoped>
.footer {
  padding: var(--space-4) 0;
  bottom: 1em;
  flex-direction: row;
  display: flex;
  justify-content: space-between;
}
.products-grid-view {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}
.form-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--space-3);
}
.product-grid-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-bottom: var(--space-4);
}
.loading-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 100%;
}
.product-creator {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}
.product-creator-collapsed {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  min-width: 0;
  overflow-x: hidden;
}
.products-section {
  position: relative;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  min-width: 0;
  overflow-x: hidden;
}

.error-message {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  margin-bottom: var(--space-4);
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-left: 4px solid rgb(239, 68, 68);
  border-radius: var(--radius-md);
}

.error-icon {
  flex-shrink: 0;
  color: rgb(239, 68, 68);
  margin-top: 2px;
}

.error-content {
  flex: 1;
  min-width: 0;
}

.error-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: rgb(239, 68, 68);
  margin: 0 0 var(--space-1) 0;
}

.error-text {
  font-size: var(--font-size-sm);
  color: rgb(185, 28, 28);
  margin: 0;
  line-height: var(--line-height-relaxed);
  word-break: break-word;
}

.submit-feedback {
  margin: var(--space-3) 0;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
}

.submit-feedback.success {
  background-color: var(--color-success-50);
  color: var(--color-success-700);
  border: 1px solid var(--color-success-200);
}

.submit-feedback.error {
  background-color: var(--color-error-50);
  color: var(--color-error-700);
  border: 1px solid var(--color-error-200);
}

/* Empty state styles */
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-state-content {
  text-align: center;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-6);
}

.empty-state-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: var(--color-primary-50);
  color: var(--color-primary-600);
  margin-bottom: var(--space-2);
}

.empty-state-title {
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
  line-height: var(--leading-tight);
}

.empty-state-description {
  font-size: var(--text-md);
  color: var(--color-text-secondary);
  margin: 0;
  line-height: var(--leading-relaxed);
  max-width: 400px;
}

.empty-state-cta {
  margin-top: var(--space-2);
}

.products-section {
  position: relative;
}

.refresh-loader {
  position: absolute;
  top: -40px;
  right: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .product-creator {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    margin-top: 0;
  }

  .products-grid-view {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 500px;
    margin-top: 0;
  }

  .product-grid-header {
    width: 100%;
  }

  .products-section {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .product-creator-collapsed {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  /* Target ProductsList within VendorProducts */
  .products-grid-view :deep(.products-list--grid) {
    width: 100%;
    max-width: 500px;
    margin: 0 auto;
  }

  .products-grid-view :deep(.grid-container) {
    justify-items: center;
  }

  .empty-state {
    min-height: 240px;
    padding: var(--space-6) var(--space-4);
  }

  .empty-state-content {
    gap: var(--space-4);
  }

  .empty-state-icon {
    width: 64px;
    height: 64px;
  }

  .empty-state-icon svg {
    width: 32px;
    height: 32px;
  }

  .empty-state-title {
    font-size: var(--text-lg);
  }

  .empty-state-description {
    font-size: var(--text-sm);
  }
}

/* Field label and error styles for QuantitySelector */
.field-label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  margin-bottom: var(--space-2);
}

.field-error {
  display: block;
  font-size: var(--font-size-sm);
  color: rgb(239, 68, 68);
  margin-top: var(--space-2);
}
</style>
