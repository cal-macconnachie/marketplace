import { get } from '../dynamo-helpers/get'
import { create } from '../dynamo-helpers/create'
import { User } from '../../handlers/users'
import { Organization } from '../../handlers/organizations'
import { convertAddressToCodes } from './address-code-converter'

export interface TaxCalculationCache {
  location: string
  tax_code: string
  tax_rate: number
  expires_at: number
  calculated_at: number
}

// Helper function to generate a location-based cache key
export function generateLocationKey(user?: User, ipAddress?: string): string {
  if (user?.address) {
    // Convert address names to codes for consistent caching
    const addressCodes = convertAddressToCodes({
      country: user.address.country,
      state: user.address.state,
      city: user.address.city,
      postal_code: user.address.postal_code
    })
    
    return `${addressCodes.country || 'unknown'}:${addressCodes.state || 'unknown'}:${addressCodes.city || 'unknown'}:${addressCodes.postal_code || 'unknown'}`
  }
  
  if (ipAddress) {
    // For IP-based location, we'll use a simplified key
    // In production, you might want to use IP geolocation services
    return `ip:${ipAddress}`
  }
  
  return ''
}

// Helper function to generate tax calculation cache key (without amount for rate-based caching)
export function generateTaxCacheKey(
  taxCode: string,
  accountId: string,
  shipFromOrg?: Organization
): string {
  // Include account_id to maintain uniqueness across different connected accounts
  let baseKey = `${taxCode}:${accountId}`

  // Include ship-from organization location if shipping is required for origin-based taxation
  if (shipFromOrg?.address) {
    // Convert organization address names to codes for consistency
    const orgAddressCodes = convertAddressToCodes({
      country: shipFromOrg.address.country,
      state: shipFromOrg.address.state,
      city: shipFromOrg.address.city,
      postal_code: shipFromOrg.address.postal_code
    })

    const shipFromLocation = `${orgAddressCodes.country}:${orgAddressCodes.state}:${orgAddressCodes.city}:${orgAddressCodes.postal_code}`
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

// Cache tax rate result (amount-independent)
export async function cacheTaxCalculation(
  location: string,
  taxCacheKey: string,
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