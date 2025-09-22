import { get } from "../dynamo-helpers/get"
import { Organization } from "../../handlers/organizations"
import { PaymentMethod } from "../../handlers/payment-methods"
import { Product } from "../../handlers/products"
import { Purchase } from "../../handlers/purchases"
import { User } from "../../handlers/users"

export interface ReceiptLineItem {
  product_id: string
  product_name: string
  product_description?: string
  quantity: number
  unit_price_formatted: string
  subtotal_formatted: string
  is_subscription?: boolean
  interval_text?: string
}

export interface ReceiptSummary {
  subtotal_formatted: string
  discounts_formatted?: string
  fees_formatted?: string
  tax_formatted?: string
  total_formatted: string
}

export interface ReceiptEmailContext {
  preheader: string
  receipt_number: string
  purchase_datetime: string
  currency: string

  organization_name: string
  organization_email?: string
  organization_logo_url?: string
  organization_address_line_1?: string
  organization_address_line_2?: string
  organization_city?: string
  organization_state?: string
  organization_postal_code?: string
  organization_country?: string
  support_url?: string

  customer_name: string
  customer_email: string

  payment_method_brand?: string
  payment_method_last4?: string
  payment_method_expiry_month?: number
  payment_method_expiry_year?: number

  line_items: ReceiptLineItem[]
  summary: ReceiptSummary
  notes?: string
}

type ProductsPurchasedEventDetail = {
  userId: string
  organizationId: string
  paymentMethodId: string
  purchases: { user_id: string; id: string }[]
  products: { group_id: string; id: string; quantity: number }[]
}

const formatCurrency = (amountMinor: number, currency: string): string => {
  // amountMinor is in smallest unit (e.g., cents)
  const amount = amountMinor / 100
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "symbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

const formatDateTime = (iso: string | undefined): string => {
  const date = iso ? new Date(iso) : new Date()
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short"
  })
}

const intervalTextFromProduct = (product?: Product): string | undefined => {
  const rec = product?.default_price_data?.recurring
  if (!rec) return undefined
  const base = rec.interval
  const count = rec.interval_count && rec.interval_count > 1 ? rec.interval_count : undefined
  const map: Record<string, string> = {
    day: "day",
    week: "week",
    month: "month",
    year: "year"
  }
  const label = map[base] || base
  return count ? `${count} ${label}s` : `${label.charAt(0).toUpperCase()}${label.slice(1)}`
}

export const collectReceiptEmailData = async (
  detail: ProductsPurchasedEventDetail
): Promise<ReceiptEmailContext> => {
  const {
    userId,
    organizationId,
    paymentMethodId,
    purchases: purchaseKeys,
    products: purchasedProducts
  } = detail

  // Load core records
  const [
    user,
    organization,
    paymentMethod
  ] = await Promise.all([
    get<User>({
      tableName: process.env.USERS_TABLE!, key: { id: userId } 
    }),
    get<Organization>({
      tableName: process.env.ORGANIZATIONS_TABLE!, key: { id: organizationId } 
    }),
    get<PaymentMethod>({
      tableName: process.env.PAYMENT_METHODS_TABLE!,
      key: {
        user_id: userId, id: paymentMethodId 
      }
    })
  ])

  if (!user) throw new Error(`User not found: ${userId}`)
  if (!organization) throw new Error(`Organization not found: ${organizationId}`)

  // Load purchases by key
  const purchases = (await Promise.all(
    purchaseKeys.map((k) =>
      get<Purchase>({
        tableName: process.env.PURCHASES_TABLE!, key: {
          id: k.id, user_id: k.user_id 
        } 
      })
    )
  )).filter(Boolean) as Purchase[]

  if (purchases.length === 0) {
    throw new Error("No purchases found for receipt generation")
  }

  // Load products for descriptions/recurrence
  // Build a lookup to fetch Product (for descriptions/interval) using event detail for group_id
  const productKeyById: Record<string, { id: string; group_id: string }> = {}
  for (const p of purchasedProducts) {
    productKeyById[p.id] = {
      id: p.id, group_id: p.group_id 
    }
  }

  const productRecords = (await Promise.all(
    Object.values(productKeyById).map((pp) =>
      get<Product>({
        tableName: process.env.PRODUCTS_TABLE!, key: {
          group_id: pp.group_id, id: pp.id 
        } 
      })
    )
  )).filter(Boolean) as Product[]

  const productById: Record<string, Product> = {}
  for (const p of productRecords) productById[p.id] = p

  // Group purchases by product_id
  const purchasesByProductId: Record<string, Purchase[]> = {}
  for (const p of purchases) {
    const pid = p.product_id
    if (!purchasesByProductId[pid]) purchasesByProductId[pid] = []
    purchasesByProductId[pid].push(p)
  }

  // Derive currency
  const currency = purchases[0]?.currency || organization.currency || "USD"

  // Compute line items
  const line_items: ReceiptLineItem[] = []
  let subtotalMinor = 0
  let taxMinor = 0
  let feesMinor = 0
  let totalMinor = 0

  const allProductIds = Object.keys(purchasesByProductId)

  for (const productId of allProductIds) {
    const qty = purchasesByProductId[productId]?.length || 1
    const relatedPurchases = purchasesByProductId[productId] || []

    // Sum amounts for this product
    let productBaseMinor = 0 // amount before tax
    let productTaxMinor = 0
    let productFeesMinor = 0
    let productTotalMinor = 0

    for (const p of relatedPurchases) {
      const tax = p.tax_amount ?? 0
      const base = p.base_amount ?? (p.amount - tax)
      productBaseMinor += base
      productTaxMinor += tax
      productFeesMinor += p.platform_fee_amount ?? 0
      productTotalMinor += p.amount
    }

    // Totals from purchase records only
    subtotalMinor += productBaseMinor
    taxMinor += productTaxMinor
    feesMinor += productFeesMinor
    totalMinor += productTotalMinor

    const name = relatedPurchases[0]?.product_name || productById[productId]?.name || productId
    const desc = productById[productId]?.description
    const isSub = relatedPurchases.some((p) => p.is_subscription) || Boolean(productById[productId]?.default_price_data?.recurring)
    const interval = intervalTextFromProduct(productById[productId])

    const unitMinor = qty > 0 ? Math.round(productBaseMinor / qty) : 0

    line_items.push({
      product_id: productId,
      product_name: name,
      product_description: desc,
      quantity: qty,
      unit_price_formatted: formatCurrency(unitMinor, currency),
      subtotal_formatted: formatCurrency(productBaseMinor, currency),
      is_subscription: isSub || undefined,
      interval_text: interval
    })
  }

  // Receipt metadata
  const receipt_number = purchases[0]?.id || `${Date.now()}`
  const purchase_datetime = formatDateTime(
    purchases
      .map((p) => p.purchased_at)
      .filter(Boolean)
      .sort()
      .reverse()[0]
  )

  const summary: ReceiptSummary = {
    subtotal_formatted: formatCurrency(subtotalMinor, currency),
    fees_formatted: feesMinor ? formatCurrency(feesMinor, currency) : undefined,
    tax_formatted: taxMinor ? formatCurrency(taxMinor, currency) : undefined,
    total_formatted: formatCurrency(totalMinor, currency)
  }

  const customer_name = user.name || [
    user.given_name,
    user.family_name
  ].filter(Boolean).join(" ") || "Customer"
  const customer_email = user.email || ""

  const context: ReceiptEmailContext = {
    preheader: `Your receipt for ${line_items.length} item(s) – ${summary.total_formatted}`,
    receipt_number,
    purchase_datetime,
    currency,

    organization_name: organization.name || "",
    organization_email: organization.email,
    // organization_logo_url: optional, not stored in Organization; leave undefined
    organization_address_line_1: organization.address?.line_1,
    organization_address_line_2: organization.address?.line_2,
    organization_city: organization.address?.city,
    organization_state: organization.address?.state,
    organization_postal_code: organization.address?.postal_code,
    organization_country: organization.address?.country,

    customer_name,
    customer_email,

    payment_method_brand: paymentMethod?.brand,
    payment_method_last4: paymentMethod?.last_four_digits,
    payment_method_expiry_month: paymentMethod?.expiry_month,
    payment_method_expiry_year: paymentMethod?.expiry_year,

    line_items: line_items.sort((a, b) => a.product_name.localeCompare(b.product_name)),
    summary
  }

  return context
}
