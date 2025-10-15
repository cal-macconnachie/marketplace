import {
  domain,
  organizationsTableName, paymentMethodsTableName, productsTableName
} from '@marketplace/constants'
import {
  Cart,
  Organization,
  PaymentMethod, Product,
  Purchase,
  ReceiptEmailContext,
  ReceiptLineItem, ReceiptSummary,
  User
} from '@marketplace/types'
import { getAllPurchasesForCart } from '../carts/get-all-purchases-for-cart'
import { get } from "../dynamo-helpers/get"

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
  detail: {
    user: User
    cart: Cart
  }
): Promise<ReceiptEmailContext> => {
  const {
    user,
    cart
  } = detail

  // Load core records - fetch purchases and payment method in parallel
  const [
    purchases,
    paymentMethod
  ] = await Promise.all([
    getAllPurchasesForCart(cart.id),
    get<PaymentMethod>({
      tableName: paymentMethodsTableName!,
      key: {
        user_id: user.id, id: cart.payment_method_id
      }
    })
  ])

  if (purchases.length === 0) {
    throw new Error("No purchases found for receipt generation")
  }

  // Load products for descriptions/recurrence
  // Build a lookup to fetch Product (for descriptions/interval) using event detail for group_id
  const productKeyById: Record<string, { id: string; group_id: string }> = {}
  for (const p of purchases) {
    productKeyById[p.product_id] = {
      id: p.product_id, group_id: p.product_group_id
    }
  }

  const productRecords = (await Promise.all(
    Object.values(productKeyById).map((pp) =>
      get<Product>({
        tableName: productsTableName!, key: {
          group_id: pp.group_id, id: pp.id
        }
      })
    )
  )).filter(Boolean) as Product[]
  const organizationIds = Array.from(new Set(productRecords.map((p) => p.organization_id)))
  const organizations = (await Promise.all(
    organizationIds.map((id) =>
      get<Organization>({
        tableName: organizationsTableName!, key: { id }
      })
    )
  )).filter(Boolean) as Organization[]

  const productById: Record<string, Product> = {}
  for (const p of productRecords) productById[p.id] = p

  // Build organizations lookup
  const orgById: Record<string, Organization> = {}
  for (const org of organizations) orgById[org.id] = org

  // Group purchases by product_id
  const purchasesByProductId: Record<string, Purchase[]> = {}
  for (const p of purchases) {
    const pid = p.product_id
    if (!purchasesByProductId[pid]) purchasesByProductId[pid] = []
    purchasesByProductId[pid].push(p)
  }

  // Derive currency
  const currency = purchases[0]?.currency

  // Compute line items
  const line_items: ReceiptLineItem[] = []
  let subtotalMinor = 0
  let taxMinor = 0
  let feesMinor = 0
  let totalMinor = 0

  const allProductIds = Object.keys(purchasesByProductId)

  // For per-seller grouping
  const groupTotals: Record<string, { base: number; tax: number; fees: number; total: number; items: ReceiptLineItem[]; descriptors: Set<string> }> = {}

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
    const isSub = relatedPurchases.some((p) => p.type === 'subscription') || Boolean(productById[productId]?.default_price_data?.recurring)
    const interval = intervalTextFromProduct(productById[productId])
    const sellerId = productById[productId]?.organization_id
    const sellerName = sellerId ? orgById[sellerId]?.name : undefined

    const unitMinor = qty > 0 ? Math.round(productBaseMinor / qty) : 0

    const item: ReceiptLineItem = {
      product_id: productId,
      product_name: name,
      product_description: desc,
      quantity: qty,
      unit_price_formatted: formatCurrency(unitMinor, currency),
      subtotal_formatted: formatCurrency(productBaseMinor, currency),
      is_subscription: isSub || undefined,
      interval_text: interval,
      seller_id: sellerId,
      seller_name: sellerName,
      purchase_id: relatedPurchases[0]?.id
    }

    line_items.push(item)

    // Accumulate per-seller totals and items
    const gid = sellerId || 'unknown'
    if (!groupTotals[gid]) {
      groupTotals[gid] = {
        base: 0, tax: 0, fees: 0, total: 0, items: [], descriptors: new Set<string>() 
      }
    }
    groupTotals[gid].base += productBaseMinor
    groupTotals[gid].tax += productTaxMinor
    groupTotals[gid].fees += productFeesMinor
    groupTotals[gid].total += productTotalMinor
    groupTotals[gid].items.push(item)
    const descriptor = productById[productId]?.statement_descriptor
    if (descriptor) groupTotals[gid].descriptors.add(descriptor)
  }

  // Receipt metadata
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

  // Sellers list (unique per organization in this receipt)
  const sellers: ReceiptEmailContext['sellers'] = organizations.map((org) => ({
    id: org.id,
    name: org.name,
    email: org.email,
    address_line_1: org.address?.line_1,
    address_line_2: org.address?.line_2,
    city: org.address?.city,
    state: org.address?.state,
    postal_code: org.address?.postal_code,
    country: org.address?.country
  }))

  const isMultiSeller = sellers.length > 1
  const headerBrand = isMultiSeller
    ? (process.env.MARKETPLACE_BRAND || 'CSM Marketplace')
    : (sellers[0]?.name || 'Seller')

  // Build seller_groups - always use groupTotals to ensure consistency
  const seller_groups = Object.entries(groupTotals).map(([
    sid,
    t
  ]) => {
    const org = sid !== 'unknown' ? orgById[sid] : undefined
    const descriptors = Array.from(t.descriptors)
    const statement_descriptor = descriptors.length === 1 ? descriptors[0] : undefined
    const support_url = org?.email
      ? `mailto:${org.email}`
      : (org?.phone ? `tel:${org.phone}` : undefined)
    return {
      seller_id: sid,
      seller_name: org?.name,
      seller_email: org?.email,
      seller_phone: org?.phone,
      address_line_1: org?.address?.line_1,
      address_line_2: org?.address?.line_2,
      city: org?.address?.city,
      state: org?.address?.state,
      postal_code: org?.address?.postal_code,
      country: org?.address?.country,
      items: t.items.sort((a, b) => a.product_name.localeCompare(b.product_name)),
      subtotal_formatted: formatCurrency(t.base, currency),
      tax_formatted: t.tax ? formatCurrency(t.tax, currency) : undefined,
      fees_formatted: t.fees ? formatCurrency(t.fees, currency) : undefined,
      total_formatted: formatCurrency(t.total, currency),
      support_url,
      statement_descriptor
    }
  })

  const receiptUrl = `https://${domain}/receipts/${cart.id}/${user.id}`
  const context: ReceiptEmailContext = {
    preheader: `Your receipt for ${line_items.length} item(s) – ${summary.total_formatted}`,
    receipt_number: cart.id,
    purchase_datetime,
    currency,
    header_brand: headerBrand,
    footer_brand: headerBrand,
    is_multi_seller: isMultiSeller,

    // For single-seller receipts, populate legacy organization_* fields for template compatibility
    ...(isMultiSeller
      ? {}
      : {
        organization_name: sellers[0]?.name,
        organization_email: sellers[0]?.email,
        organization_address_line_1: sellers[0]?.address_line_1,
        organization_address_line_2: sellers[0]?.address_line_2,
        organization_city: sellers[0]?.city,
        organization_state: sellers[0]?.state,
        organization_postal_code: sellers[0]?.postal_code,
        organization_country: sellers[0]?.country
      }),

    customer_name,
    customer_email,
    customer_phone: user.phone_number || undefined,

    payment_method_brand: paymentMethod?.brand,
    payment_method_last4: paymentMethod?.last_four_digits,
    payment_method_expiry_month: paymentMethod?.expiry_month,
    payment_method_expiry_year: paymentMethod?.expiry_year,

    line_items: line_items
      .sort((a, b) => a.product_name.localeCompare(b.product_name)),
    summary,
    sellers,
    seller_groups,
    receipt_url: receiptUrl
  }
  context.customer_ip_address = cart.ip_address || user.ip_address || undefined

  return context
}
