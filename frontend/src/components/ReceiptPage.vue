<template>
  <div class="receipt-page">
    <div v-if="loading" class="loading">
      <LoadingSpinner :size="40" />
      <p>Loading receipt...</p>
    </div>

    <BaseAlert
      v-else-if="error"
      variant="error"
      title="Error Loading Receipt"
      :message="error"
    >
      <template #actions>
        <BaseButton variant="secondary" size="sm" @click="$router.push('/')">
          Back to Dashboard
        </BaseButton>
      </template>
    </BaseAlert>

    <div v-else-if="receipt" class="receipt-wrapper">
      <div class="receipt-actions">
        <BaseButton
          variant="primary"
          :loading="downloadingPDF"
          :disabled="downloadingPDF"
          @click="downloadPDF"
        >
          {{ downloadingPDF ? 'Generating PDF...' : 'Download PDF' }}
        </BaseButton>
        <BaseButton variant="secondary" @click="$router.push('/')">
          Back to Dashboard
        </BaseButton>
      </div>

      <div id="receipt-content" class="receipt-container">
        <!-- Header -->
        <div class="receipt-header">
          <div class="brand">{{ receipt.header_brand }}</div>
          <div v-if="receipt.receipt_number" class="receipt-number">Receipt #{{ receipt.receipt_number }}</div>
        </div>

        <hr class="divider" />

        <!-- Greeting -->
        <div class="greeting">
          <h1>Thank you for your purchase<span v-if="receipt.customer_name">, {{ receipt.customer_name }}</span>!</h1>
        </div>

        <!-- Line Items -->
        <div v-if="receipt.is_multi_seller" class="multi-seller-section">
          <div v-for="group in receipt.seller_groups" :key="group.seller_id" class="seller-group">
            <div class="seller-label">
              Seller: {{ group.seller_name || group.seller_id }}
            </div>

            <table class="items-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th class="qty">Qty</th>
                  <th class="price">Price</th>
                  <th class="amount">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in group.items" :key="item.product_id">
                  <td>
                    <div class="product-name">{{ item.product_name }}</div>
                    <div v-if="item.product_description" class="product-description">
                      {{ item.product_description }}
                    </div>
                    <div class="product-meta">
                      <span v-if="item.product_id" class="meta-text">ID: {{ item.product_id }}</span>
                      <span v-if="item.is_subscription" class="badge">
                        Subscription<span v-if="item.interval_text"> • {{ item.interval_text }}</span>
                      </span>
                    </div>
                  </td>
                  <td class="qty">{{ item.quantity }}</td>
                  <td class="price">{{ item.unit_price_formatted }}</td>
                  <td class="amount">{{ item.subtotal_formatted }}</td>
                </tr>
              </tbody>
            </table>

            <!-- Seller Totals -->
            <div class="totals-section">
              <table class="totals-table">
                <tr>
                  <td class="label">Subtotal</td>
                  <td class="value">{{ group.subtotal_formatted }}</td>
                </tr>
                <tr v-if="group.fees_formatted">
                  <td class="label">Fees</td>
                  <td class="value">{{ group.fees_formatted }}</td>
                </tr>
                <tr v-if="group.tax_formatted">
                  <td class="label">Tax</td>
                  <td class="value">{{ group.tax_formatted }}</td>
                </tr>
                <tr class="grand-total">
                  <td class="label">Total</td>
                  <td class="value">{{ group.total_formatted }}</td>
                </tr>
              </table>
              <div v-if="group.statement_descriptor || group.support_url" class="seller-meta">
                <div v-if="group.statement_descriptor">Descriptor: {{ group.statement_descriptor }}</div>
                <div v-if="group.support_url">
                  Support: <a :href="group.support_url">Contact</a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Single Seller -->
        <div v-else class="single-seller-section">
          <table class="items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th class="qty">Qty</th>
                <th class="price">Price</th>
                <th class="amount">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in receipt.line_items" :key="item.product_id">
                <td>
                  <div class="product-name">{{ item.product_name }}</div>
                  <div v-if="item.product_description" class="product-description">
                    {{ item.product_description }}
                  </div>
                  <div class="product-meta">
                    <span v-if="item.is_subscription" class="badge">
                      Subscription<span v-if="item.interval_text"> • {{ item.interval_text }}</span>
                    </span>
                    <span v-if="item.seller_name" class="badge">Seller: {{ item.seller_name }}</span>
                  </div>
                </td>
                <td class="qty">{{ item.quantity }}</td>
                <td class="price">{{ item.unit_price_formatted }}</td>
                <td class="amount">{{ item.subtotal_formatted }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Overall Totals -->
        <div class="totals-section">
          <table class="totals-table">
            <tr>
              <td class="label">Subtotal</td>
              <td class="value">{{ receipt.summary.subtotal_formatted }}</td>
            </tr>
            <tr v-if="receipt.summary.discounts_formatted">
              <td class="label">Discounts</td>
              <td class="value">-{{ receipt.summary.discounts_formatted }}</td>
            </tr>
            <tr v-if="receipt.summary.tax_formatted">
              <td class="label">Tax</td>
              <td class="value">{{ receipt.summary.tax_formatted }}</td>
            </tr>
            <tr class="grand-total">
              <td class="label">Total</td>
              <td class="value">{{ receipt.summary.total_formatted }}</td>
            </tr>
          </table>
        </div>

        <!-- Payment Method -->
        <div v-if="receipt.payment_method_brand || receipt.payment_method_last4" class="payment-method">
          <span v-if="receipt.payment_method_brand">Paid with {{ receipt.payment_method_brand }}</span>
          <span v-if="receipt.payment_method_last4"> •••• {{ receipt.payment_method_last4 }}</span>
          <span v-if="receipt.payment_method_expiry_month">
            (exp {{ receipt.payment_method_expiry_month }}/{{ receipt.payment_method_expiry_year }})
          </span>
        </div>

        <hr class="divider" />

        <!-- Customer & Organization Details -->
        <div class="details-section">
          <div class="detail-column">
            <div class="detail-label">Billed To</div>
            <div class="detail-value">{{ receipt.customer_name }}</div>
            <div v-if="receipt.customer_email" class="detail-muted">{{ receipt.customer_email }}</div>
          </div>

          <div class="detail-column">
            <div v-if="receipt.is_multi_seller">
              <div class="detail-label">Sellers</div>
              <div v-for="seller in receipt.sellers" :key="seller.id" class="seller-info">
                <div class="detail-value">{{ seller.name }}</div>
                <div v-if="seller.email" class="detail-muted">{{ seller.email }}</div>
                <div v-if="seller.address_line_1" class="detail-muted address">
                  <div>{{ seller.address_line_1 }}</div>
                  <div v-if="seller.address_line_2">{{ seller.address_line_2 }}</div>
                  <div>{{ seller.city }}, {{ seller.state }} {{ seller.postal_code }}</div>
                  <div>{{ seller.country }}</div>
                </div>
              </div>
            </div>
            <div v-else>
              <div class="detail-label">Seller</div>
              <div class="detail-value">{{ receipt.organization_name }}</div>
              <div v-if="receipt.organization_email" class="detail-muted">{{ receipt.organization_email }}</div>
              <div v-if="receipt.organization_address_line_1" class="detail-muted address">
                <div>{{ receipt.organization_address_line_1 }}</div>
                <div v-if="receipt.organization_address_line_2">{{ receipt.organization_address_line_2 }}</div>
                <div>{{ receipt.organization_city }}, {{ receipt.organization_state }} {{ receipt.organization_postal_code }}</div>
                <div>{{ receipt.organization_country }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="receipt-footer">
          <div v-if="receipt.purchase_datetime" class="footer-text">
            Purchase Date: {{ receipt.purchase_datetime }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import { authAPI } from '@/services/api'
import type { ReceiptEmailContext } from '@marketplace/types'
import html2pdf from 'html2pdf.js'
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const loading = ref(true)
const error = ref<string | null>(null)
const receipt = ref<ReceiptEmailContext | null>(null)
const downloadingPDF = ref(false)

onMounted(async () => {
  const cartId = route.params.cartId as string
  const userId = route.params.userId as string

  if (!cartId) {
    error.value = 'No receipt ID provided'
    loading.value = false
    return
  }
  if (!userId) {
    error.value = 'No user ID provided'
    loading.value = false
    return
  }

  try {
    receipt.value = await authAPI.getReceipt(cartId, userId)
  } catch (err) {
    console.error('Error fetching receipt:', err)
    error.value = (err as unknown as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to load receipt'
  } finally {
    loading.value = false
  }
})

const downloadPDF = async () => {
  if (!receipt.value) return

  downloadingPDF.value = true

  try {
    const element = document.getElementById('receipt-content')
    if (!element) {
      throw new Error('Receipt content not found')
    }

    const opt = {
      margin: 10,
      filename: `receipt-${receipt.value.receipt_number}.pdf`,
      image: { type: 'png' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
    }

    await html2pdf().set(opt).from(element).save()
  } catch (err) {
    console.error('Error generating PDF:', err)
    alert('Failed to generate PDF. Please try again.')
  } finally {
    downloadingPDF.value = false
  }
}
</script>

<style scoped>
/* Page Layout */
.receipt-page {
  min-height: 100vh;
  background: var(--color-bg-secondary);
  padding: var(--space-8);
}

/* Loading State */
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: var(--space-4);
}

.loading p {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
}

/* Receipt Wrapper */
.receipt-wrapper {
  max-width: var(--size-2xl);
  margin: 0 auto;
}

/* Action Buttons */
.receipt-actions {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-6);
  justify-content: flex-end;
}

/* Receipt Container */
.receipt-container {
  background: var(--color-bg-primary);
  border-radius: var(--radius-xl);
  padding: var(--space-8);
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--color-border);
}

/* Header */
.receipt-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-6);
}

.brand {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  letter-spacing: -0.02em;
}

.receipt-number {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  font-family: var(--font-family-mono);
}

/* Divider */
.divider {
  border: none;
  height: 1px;
  background: var(--color-border);
  margin: var(--space-6) 0;
}

/* Greeting */
.greeting h1 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
  margin: 0 0 var(--space-6) 0;
  color: var(--color-text-primary);
}

/* Seller Label */
.seller-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  margin: var(--space-6) 0 var(--space-3) 0;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.seller-group:first-child .seller-label {
  margin-top: 0;
}

/* Items Table */
.items-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: var(--space-4);
}

.items-table th {
  text-align: left;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: var(--space-2) 0;
  border-bottom: 2px solid var(--color-border);
}

.items-table td {
  vertical-align: top;
  padding: var(--space-4) 0;
  border-bottom: 1px solid var(--color-border);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
}

.items-table .qty,
.items-table .price,
.items-table .amount {
  text-align: right;
  white-space: nowrap;
  font-family: var(--font-family-mono);
}

.product-name {
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--space-1);
  color: var(--color-text-primary);
}

.product-description {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin-top: var(--space-1);
  line-height: var(--line-height-relaxed);
}

.product-meta {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-top: var(--space-2);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.badge {
  display: inline-block;
  font-size: var(--font-size-2xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  background: var(--color-bg-muted);
  border-radius: var(--radius-full);
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--color-border);
}

/* Totals Section */
.totals-section {
  margin: var(--space-6) 0;
}

.totals-table {
  width: 100%;
  max-width: 20rem;
  margin-left: auto;
}

.totals-table td {
  padding: var(--space-2) 0;
  font-size: var(--font-size-sm);
}

.totals-table .label {
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
}

.totals-table .value {
  text-align: right;
  font-family: var(--font-family-mono);
  color: var(--color-text-primary);
}

.totals-table .grand-total {
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-lg);
  border-top: 2px solid var(--color-border);
  padding-top: var(--space-3);
  margin-top: var(--space-2);
}

.seller-meta {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-top: var(--space-3);
  line-height: var(--line-height-relaxed);
}

.seller-meta a {
  color: var(--color-primary);
  text-decoration: none;
  transition: var(--transition-fast);
}

.seller-meta a:hover {
  color: var(--color-primary-hover);
  text-decoration: underline;
}

/* Payment Method */
.payment-method {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-6);
  padding: var(--space-3);
  background: var(--color-bg-muted);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  font-family: var(--font-family-mono);
}

/* Details Section */
.details-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-8);
  margin: var(--space-6) 0;
  padding: var(--space-6);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
}

.detail-column {
  font-size: var(--font-size-sm);
}

.detail-column:last-child {
  text-align: right;
}

.detail-label {
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  margin-bottom: var(--space-2);
}

.detail-value {
  margin-bottom: var(--space-1);
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
}

.detail-muted {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  line-height: var(--line-height-relaxed);
}

.address {
  margin-top: var(--space-2);
  line-height: var(--line-height-relaxed);
}

.seller-info {
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.seller-info:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

/* Footer */
.receipt-footer {
  text-align: center;
  padding-top: var(--space-6);
  margin-top: var(--space-6);
  border-top: 1px solid var(--color-border);
}

.footer-text {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-family: var(--font-family-mono);
}

/* Responsive Design */
@media (max-width: 768px) {
  .receipt-page {
    padding: var(--space-4);
  }

  .receipt-container {
    padding: var(--space-4);
    border-radius: var(--radius-lg);
  }

  .receipt-actions {
    flex-direction: column;
  }

  .items-table th,
  .items-table td {
    font-size: var(--font-size-xs);
  }

  .items-table .qty,
  .items-table .price {
    display: none;
  }

  .details-section {
    grid-template-columns: 1fr;
    gap: var(--space-6);
    padding: var(--space-4);
  }

  .detail-column:last-child {
    text-align: left;
  }

  .brand {
    font-size: var(--font-size-xl);
  }

  .greeting h1 {
    font-size: var(--font-size-xl);
  }
}

/* Print Styles */
@media print {
  .receipt-actions {
    display: none;
  }

  .receipt-page {
    background: white;
    padding: 0;
  }

  .receipt-container {
    background: white;
    color: black;
    box-shadow: none;
    border: none;
  }

  .receipt-container * {
    color: black !important;
    border-color: #ddd !important;
  }

  .badge {
    border-color: #999 !important;
  }
}
</style>
