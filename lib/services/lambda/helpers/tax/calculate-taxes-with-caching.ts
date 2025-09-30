import { getStripeClient } from '../stripe/stripe-client'
import { Product } from '../../handlers/products'
import { Organization } from '../../handlers/organizations'
import { 
  generateTaxCacheKey, 
  getCachedTaxCalculation, 
  cacheTaxCalculation 
} from './tax-calculation-cache'
import { calculateTaxWithStripe } from './stripe-tax-calculation'

export interface ItemsInterface {
  group_id: string
  id: string
  organization_id: string
  quantity: number
}

export interface TaxCalculationResult {
  items: Array<{
    id: string
    group_id: string
    organization_id: string
    quantity: number
    amount: number
    tax_amount: number
    tax_rate: number
    currency: string
  }>
  total_amount: number
  total_tax: number
}

// Main tax calculation function with caching
export async function calculateTaxesWithCaching(
  items: ItemsInterface[],
  productsHash: { [productKey: string]: Product },
  orgsHash: { [orgId: string]: Organization },
  location: string
): Promise<TaxCalculationResult> {
  const stripe = getStripeClient()
  const taxCalculations: Array<{
    id: string
    group_id: string
    organization_id: string
    quantity: number
    amount: number
    tax_amount: number
    tax_rate: number
    currency: string
  }> = []
  
  let totalAmount = 0
  let totalTax = 0
  
  for (const item of items) {
    const productKey = `${item.group_id}:${item.id}`
    const product = productsHash[productKey]
    
    if (!product) {
      console.warn(`Product not found: ${productKey}`)
      continue
    }
    const currency = product.default_price_data.currency

    // Calculate item total amount
    const itemAmount = product.default_price_data.unit_amount * item.quantity
    const sellerOrganization = orgsHash[product.organization_id]
    const requiresShipping = product.metadata?.shipping_required === 'true'
    const shipFromOrg = requiresShipping ? sellerOrganization : undefined
    const taxCacheKey = generateTaxCacheKey(product.tax_code || 'txcd_99999999', product.account_id, shipFromOrg)
    
    // Try to get cached tax rate
    let taxAmount = 0
    let taxRate = 0
    
    try {
      const cachedTax = await getCachedTaxCalculation(location, taxCacheKey)
      
      if (cachedTax) {
        // Use cached tax rate to calculate tax amount manually
        taxRate = cachedTax.tax_rate
        const totalWithTax = Math.round(itemAmount * (1 + taxRate / 100))
        taxAmount = totalWithTax - itemAmount
      } else {
        // Calculate tax using Stripe with a sample amount to get the rate
        const taxCalculation = await calculateTaxWithStripe(stripe, {
          amount: 100, // Use standard amount to get tax rate
          currency,
          tax_code: product.tax_code || 'txcd_99999999', // Default tax code
          reference: `${product.name} (sample for rate)`,
          location,
          shipFromOrg,
          stripeAccountId: sellerOrganization?.stripe_account_id
        })
        
        taxRate = taxCalculation.tax_rate
        const totalWithTax = Math.round(itemAmount * (1 + taxRate / 100))
        taxAmount = totalWithTax - itemAmount

        // Cache the tax rate (not amount-specific)
        await cacheTaxCalculation(
          location,
          taxCacheKey,
          taxRate
        )
      }
    } catch (error) {
      console.error('Error getting/setting tax cache:', error)
      // Fallback to direct Stripe calculation
      const taxCalculation = await calculateTaxWithStripe(stripe, {
        amount: 100, // Use standard amount to get tax rate
        currency,
        tax_code: product.tax_code || 'txcd_99999999',
        reference: `${product.name} (sample for rate)`,
        location,
        shipFromOrg,
        stripeAccountId: sellerOrganization?.stripe_account_id
      })
      
      taxRate = taxCalculation.tax_rate
      const totalWithTax = Math.round(itemAmount * (1 + taxRate / 100))
      taxAmount = totalWithTax - itemAmount
    }

    taxCalculations.push({
      id: item.id,
      group_id: item.group_id,
      organization_id: item.organization_id,
      quantity: item.quantity,
      amount: itemAmount,
      tax_amount: taxAmount,
      tax_rate: taxRate,
      currency
    })
    
    totalAmount += itemAmount
    totalTax += taxAmount
  }
  
  return {
    items: taxCalculations,
    total_amount: totalAmount,
    total_tax: totalTax
  }
}