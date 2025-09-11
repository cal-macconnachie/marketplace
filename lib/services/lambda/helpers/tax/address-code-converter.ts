import { countryToAlpha2 } from 'country-to-iso'
import { iso31662 } from 'iso-3166'

interface AddressInput {
  country: string
  state: string
  city?: string
  postal_code?: string
}

interface AddressCodes {
  country: string
  state: string
  city?: string
  postal_code?: string
}

// Helper function to convert state/province name to ISO 3166-2 subdivision code
function getStateCode(stateName: string, countryCode: string): string {
  if (!stateName || stateName === 'unknown') return 'unknown'
  
  // If it's already a code format (2-3 characters), return as-is
  if (stateName.length <= 3 && /^[A-Z0-9]+$/.test(stateName)) {
    return stateName
  }
  
  // Find matching subdivision in ISO 3166-2 data
  const subdivision = iso31662.find(sub => 
    sub.parent === countryCode && 
    sub.name.toLowerCase() === stateName.toLowerCase()
  )
  
  if (subdivision) {
    // Return just the subdivision part (after the dash)
    return subdivision.code.split('-')[1]
  }
  
  // Common US state name mappings for cases not found in ISO data
  if (countryCode === 'US') {
    const usStateMap: Record<string, string> = {
      'alabama': 'AL',
      'alaska': 'AK',
      'arizona': 'AZ',
      'arkansas': 'AR',
      'california': 'CA',
      'colorado': 'CO',
      'connecticut': 'CT',
      'delaware': 'DE',
      'florida': 'FL',
      'georgia': 'GA',
      'hawaii': 'HI',
      'idaho': 'ID',
      'illinois': 'IL',
      'indiana': 'IN',
      'iowa': 'IA',
      'kansas': 'KS',
      'kentucky': 'KY',
      'louisiana': 'LA',
      'maine': 'ME',
      'maryland': 'MD',
      'massachusetts': 'MA',
      'michigan': 'MI',
      'minnesota': 'MN',
      'mississippi': 'MS',
      'missouri': 'MO',
      'montana': 'MT',
      'nebraska': 'NE',
      'nevada': 'NV',
      'new hampshire': 'NH',
      'new jersey': 'NJ',
      'new mexico': 'NM',
      'new york': 'NY',
      'north carolina': 'NC',
      'north dakota': 'ND',
      'ohio': 'OH',
      'oklahoma': 'OK',
      'oregon': 'OR',
      'pennsylvania': 'PA',
      'rhode island': 'RI',
      'south carolina': 'SC',
      'south dakota': 'SD',
      'tennessee': 'TN',
      'texas': 'TX',
      'utah': 'UT',
      'vermont': 'VT',
      'virginia': 'VA',
      'washington': 'WA',
      'west virginia': 'WV',
      'wisconsin': 'WI',
      'wyoming': 'WY',
      'district of columbia': 'DC'
    }
    
    const code = usStateMap[stateName.toLowerCase()]
    if (code) return code
  }
  
  // Return original if no conversion found
  return stateName
}

// Convert address with full names to address with codes
export function convertAddressToCodes(address: AddressInput): AddressCodes {
  // Convert country name to ISO Alpha-2 code
  let countryCode: string
  try {
    countryCode = countryToAlpha2(address.country) || address.country
  } catch {
    countryCode = address.country
  }
  
  // Convert state/province name to code
  const stateCode = getStateCode(address.state, countryCode)
  
  return {
    country: countryCode,
    state: stateCode,
    city: address.city,
    postal_code: address.postal_code
  }
}