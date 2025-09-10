import { get } from '../dynamo-helpers/get'
import { create } from '../dynamo-helpers/create'
import { User } from '../../handlers/users'
import { Organization } from '../../handlers/organizations'

export interface TaxCalculationCache {
  location: string
  tax_code: string
  amount: number
  currency: string
  tax_amount: number
  tax_rate: number
  expires_at: number
  calculated_at: number
}

// Helper function to generate a location-based cache key
export function generateLocationKey(user?: User, ipAddress?: string): string {
  if (user?.address) {
    const {
      country, state, city, postal_code
    } = user.address
    return `${country || 'unknown'}:${state || 'unknown'}:${city || 'unknown'}:${postal_code || 'unknown'}`
  }
  
  if (ipAddress) {
    // For IP-based location, we'll use a simplified key
    // In production, you might want to use IP geolocation services
    return `ip:${ipAddress}`
  }
  
  return 'unknown:unknown:unknown:unknown'
}

// Helper function to generate tax calculation cache key
export function generateTaxCacheKey(
  location: string, 
  productId: string, 
  amount: number, 
  currency: string, 
  shipFromOrg?: Organization
): string {
  let baseKey = `${location}:${productId}:${amount}:${currency}`
  
  // Include ship-from organization location if shipping is required
  if (shipFromOrg?.address) {
    const orgAddr = shipFromOrg.address
    const shipFromLocation = `${orgAddr.country}:${orgAddr.state}:${orgAddr.city}:${orgAddr.postal_code}`
    baseKey += `:ship_from:${shipFromLocation}`
  }
  
  return baseKey
}

// Get cached tax calculation
export async function getCachedTaxCalculation(
  location: string, 
  taxCacheKey: string
): Promise<TaxCalculationCache | null> {
  try {
    const cachedTax = await get<TaxCalculationCache>({
      tableName: process.env.TAX_CALCULATIONS_TABLE!,
      key: {
        location,
        tax_code: taxCacheKey
      }
    })
    
    // Check if cache is still valid
    if (cachedTax && cachedTax.expires_at > Math.floor(Date.now() / 1000)) {
      return cachedTax
    }
    
    return null
  } catch (error) {
    console.error('Error getting cached tax calculation:', error)
    return null
  }
}

// Cache tax calculation result
export async function cacheTaxCalculation(
  location: string,
  taxCacheKey: string,
  amount: number,
  currency: string,
  taxAmount: number,
  taxRate: number
): Promise<void> {
  try {
    const expiresAt = Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    await create({
      tableName: process.env.TAX_CALCULATIONS_TABLE!,
      key: {
        location,
        tax_code: taxCacheKey
      },
      record: {
        amount,
        currency,
        tax_amount: taxAmount,
        tax_rate: taxRate,
        expires_at: expiresAt,
        calculated_at: Math.floor(Date.now() / 1000)
      }
    })
  } catch (error) {
    console.error('Error caching tax calculation:', error)
    // Don't throw - caching failures shouldn't break the main flow
  }
}