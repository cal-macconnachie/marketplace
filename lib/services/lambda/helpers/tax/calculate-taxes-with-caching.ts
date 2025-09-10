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
  }>
  total_amount: number
  total_tax: number
  currency: string
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
  }> = []
  
  let totalAmount = 0
  let totalTax = 0
  const currency = 'usd' // Default currency, could be made dynamic
  
  for (const item of items) {
    const productKey = `${item.group_id}:${item.id}`
    const product = productsHash[productKey]
    
    if (!product) {
      console.warn(`Product not found: ${productKey}`)
      continue
    }
    
    // Calculate item total amount
    const itemAmount = product.default_price_data.unit_amount * item.quantity
    const organization = orgsHash[item.organization_id]
    const requiresShipping = product.metadata?.shipping_required === 'true'
    const shipFromOrg = requiresShipping ? organization : undefined
    const taxCacheKey = generateTaxCacheKey(location, productKey, itemAmount, currency, shipFromOrg)
    
    // Try to get cached tax calculation
    let taxAmount = 0
    let taxRate = 0
    
    try {
      const cachedTax = await getCachedTaxCalculation(location, taxCacheKey)
      
      if (cachedTax) {
        taxAmount = cachedTax.tax_amount
        taxRate = cachedTax.tax_rate
      } else {
        // Calculate tax using Stripe
        const taxCalculation = await calculateTaxWithStripe(stripe, {
          amount: itemAmount,
          currency,
          tax_code: product.tax_code || 'txcd_99999999', // Default tax code
          reference: `${product.name} (${item.quantity}x)`,
          location,
          shipFromOrg
        })
        
        taxAmount = taxCalculation.tax_amount
        taxRate = taxCalculation.tax_rate
        
        // Cache the result
        await cacheTaxCalculation(
          location,
          taxCacheKey,
          itemAmount,
          currency,
          taxAmount,
          taxRate
        )
      }
    } catch (error) {
      console.error('Error getting/setting tax cache:', error)
      // Fallback to direct Stripe calculation
      const taxCalculation = await calculateTaxWithStripe(stripe, {
        amount: itemAmount,
        currency,
        tax_code: product.tax_code || 'txcd_99999999',
        reference: `${product.name} (${item.quantity}x)`,
        location,
        shipFromOrg
      })
      
      taxAmount = taxCalculation.tax_amount
      taxRate = taxCalculation.tax_rate
    }
    
    taxCalculations.push({
      id: item.id,
      group_id: item.group_id,
      organization_id: item.organization_id,
      quantity: item.quantity,
      amount: itemAmount,
      tax_amount: taxAmount,
      tax_rate: taxRate
    })
    
    totalAmount += itemAmount
    totalTax += taxAmount
  }
  
  return {
    items: taxCalculations,
    total_amount: totalAmount,
    total_tax: totalTax,
    currency
  }
}