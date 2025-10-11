<template>
  <div class="receipt-page">
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>Loading receipt...</p>
    </div>

    <div v-else-if="error" class="error-container">
      <h2>Error Loading Receipt</h2>
      <p>{{ error }}</p>
      <button @click="$router.push('/dashboard')" class="btn-secondary">Back to Dashboard</button>
    </div>

    <div v-else-if="receipt" class="receipt-wrapper">
      <div class="receipt-actions">
        <button @click="downloadPDF" class="btn-primary" :disabled="downloadingPDF">
          {{ downloadingPDF ? 'Generating PDF...' : 'Download PDF' }}
        </button>
        <button @click="$router.push('/dashboard')" class="btn-secondary">Back to Dashboard</button>
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

  if (!cartId) {
    error.value = 'No receipt ID provided'
    loading.value = false
    return
  }

  try {
    receipt.value = await authAPI.getReceipt(cartId)
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
.receipt-page {
  min-height: 100vh;
  background: var(--color-background-soft);
  padding: 2rem;
}

.loading,
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 1rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.receipt-wrapper {
  max-width: 800px;
  margin: 0 auto;
}

.receipt-actions {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  justify-content: flex-end;
}

.btn-primary,
.btn-secondary {
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--color-background-mute);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover {
  background: var(--color-background-soft);
}

.receipt-container {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.receipt-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.brand {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-heading);
}

.receipt-number {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.divider {
  border: none;
  height: 1px;
  background: var(--color-border);
  margin: 1.5rem 0;
}

.greeting h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 1.5rem 0;
  color: var(--color-heading);
}

.seller-label {
  font-size: 0.875rem;
  font-weight: 600;
  margin: 1.5rem 0 0.75rem 0;
  color: var(--color-text);
}

.seller-group:first-child .seller-label {
  margin-top: 0;
}

.items-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1rem;
}

.items-table th {
  text-align: left;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--color-border);
}

.items-table td {
  vertical-align: top;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--color-border-soft);
  font-size: 0.875rem;
}

.items-table .qty,
.items-table .price,
.items-table .amount {
  text-align: right;
  white-space: nowrap;
}

.product-name {
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.product-description {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-top: 0.25rem;
}

.product-meta {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.badge {
  display: inline-block;
  font-size: 0.688rem;
  color: var(--color-text);
  background: var(--color-background-mute);
  border-radius: 999px;
  padding: 2px 8px;
}

.totals-section {
  margin: 1.5rem 0;
}

.totals-table {
  width: 100%;
  max-width: 300px;
  margin-left: auto;
}

.totals-table td {
  padding: 0.375rem 0;
  font-size: 0.875rem;
}

.totals-table .label {
  color: var(--color-text-muted);
}

.totals-table .value {
  text-align: right;
}

.totals-table .grand-total {
  font-weight: 700;
  border-top: 2px solid var(--color-border);
  padding-top: 0.625rem;
}

.seller-meta {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-top: 0.5rem;
}

.seller-meta a {
  color: var(--color-primary);
  text-decoration: none;
}

.seller-meta a:hover {
  text-decoration: underline;
}

.payment-method {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-bottom: 1.5rem;
}

.details-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin: 1.5rem 0;
}

.detail-column {
  font-size: 0.875rem;
}

.detail-column:last-child {
  text-align: right;
}

.detail-label {
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.detail-value {
  margin-bottom: 0.25rem;
}

.detail-muted {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.address {
  margin-top: 0.5rem;
  line-height: 1.4;
}

.seller-info {
  margin-bottom: 1rem;
}

.seller-info:last-child {
  margin-bottom: 0;
}

.receipt-footer {
  text-align: center;
  padding-top: 1.5rem;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

@media (max-width: 768px) {
  .receipt-page {
    padding: 1rem;
  }

  .receipt-container {
    padding: 1rem;
  }

  .receipt-actions {
    flex-direction: column;
  }

  .items-table .qty,
  .items-table .price {
    display: none;
  }

  .details-section {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .detail-column:last-child {
    text-align: left;
  }
}

@media print {
  .receipt-actions {
    display: none;
  }

  .receipt-page {
    background: white;
    padding: 0;
  }

  .receipt-container {
    box-shadow: none;
  }
}
</style>
