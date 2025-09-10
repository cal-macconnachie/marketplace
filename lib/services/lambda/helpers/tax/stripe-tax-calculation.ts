import Stripe from 'stripe'
import { Organization } from '../../handlers/organizations'

export interface TaxCalculationResult {
  tax_amount: number
  tax_rate: number
}

// Helper function to calculate tax with Stripe API
export async function calculateTaxWithStripe(
  stripe: Stripe,
  params: {
    amount: number
    currency: string
    tax_code: string
    reference: string
    location: string
    shipFromOrg?: Organization
  }
): Promise<TaxCalculationResult> {
  // Parse location for customer details
  console.log('Tax calculation location:', params.location)
  const locationParts = params.location.split(':')
  let customerDetails: Stripe.Tax.CalculationCreateParams.CustomerDetails
  
  if (params.location.startsWith('ip:')) {
    // IP-based location
    customerDetails = {
      ip_address: locationParts[1]
    }
  } else {
    // Address-based location
    const [
      country,
      state,
      city,
      postal_code
    ] = locationParts
    customerDetails = {
      address: {
        country: country !== 'unknown' ? country : 'US', // Default to US
        state: state !== 'unknown' ? state : undefined,
        city: city !== 'unknown' ? city : undefined,
        postal_code: postal_code !== 'unknown' ? postal_code : undefined
      },
      address_source: 'shipping'
    }
  }
  
  // Prepare ship_from_details if organization address is provided
  let shipFromDetails: Stripe.Tax.CalculationCreateParams.ShipFromDetails | undefined
  if (params.shipFromOrg?.address) {
    const orgAddress = params.shipFromOrg.address
    shipFromDetails = {
      address: {
        country: orgAddress.country,
        state: orgAddress.state,
        city: orgAddress.city,
        postal_code: orgAddress.postal_code,
        line1: orgAddress.line_1,
        line2: orgAddress.line_2
      }
    }
  }

  try {
    const calculationParams: Stripe.Tax.CalculationCreateParams = {
      currency: params.currency,
      customer_details: customerDetails,
      line_items: [
        {
          amount: params.amount,
          tax_code: params.tax_code,
          reference: params.reference,
          tax_behavior: 'exclusive'
        }
      ],
      expand: ['line_items']
    }
    
    // Add ship_from_details if available
    if (shipFromDetails) {
      calculationParams.ship_from_details = shipFromDetails
    }
    
    const calculation = await stripe.tax.calculations.create(calculationParams)
    
    const lineItem = calculation.line_items?.data?.[0]
    if (lineItem) {
      const taxAmount = lineItem.amount_tax || 0
      const taxRate = taxAmount > 0 ? (taxAmount / lineItem.amount) * 100 : 0
      
      return {
        tax_amount: taxAmount,
        tax_rate: taxRate
      }
    }
    
    return {
      tax_amount: 0, tax_rate: 0
    }
  } catch (error) {
    console.error('Stripe tax calculation error:', error)
    // Return 0 tax on error - you might want to handle this differently
    return {
      tax_amount: 0, tax_rate: 0
    }
  }
}