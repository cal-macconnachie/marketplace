import Stripe from 'stripe'
import { User } from '../../handlers/users'
import { get } from '../dynamo-helpers/get'
import { getStripeClient } from './stripe-client'
import { update } from '../dynamo-helpers/update'
import getCurrencyByCountry from 'country-to-currency'
import { Organization } from '../../handlers/organizations'

// Validation functions
const validateBankAccount = (bankDetails: {
  account_number: string
  routing_number: string
}, country: string) => {
  const {
    account_number,
    routing_number
  } = bankDetails
  
  if (!account_number || account_number.length < 4) {
    throw new Error('Invalid account number')
  }
  
  if (country === 'US') {
    if (!routing_number || routing_number.length !== 9) {
      throw new Error('US routing numbers must be 9 digits')
    }
  }
  
  if (country === 'CA') {
    if (!routing_number || routing_number.length < 8 || routing_number.length > 9) {
      throw new Error('Canadian transit numbers must be 8-9 digits')
    }
  }
}

const handleStripeError = (error: unknown) => {
  const stripeError = error as { 
    type?: string
    message?: string
    code?: string
    requestId?: string
  }
  if (stripeError?.type === 'StripeCardError') {
    throw new Error(`Payment error: ${stripeError.message}`)
  } else if (stripeError?.type === 'StripeInvalidRequestError') {
    throw new Error(`Invalid request: ${stripeError.message}`)
  } else if (stripeError?.type === 'StripeAPIError') {
    throw new Error('Stripe service temporarily unavailable. Please try again.')
  } else if (stripeError?.type === 'StripeConnectionError') {
    throw new Error('Network error connecting to Stripe. Please try again.')
  } else if (stripeError?.type === 'StripeAuthenticationError') {
    throw new Error('Stripe authentication failed')
  } else {
    throw new Error(`Account creation failed: ${stripeError?.message || 'Unknown error'}`)
  }
}

interface CreateConnectedAccountResult {
  account: Stripe.Account
  onboardingUrl?: string
  requiresOnboarding: boolean
  missingRequirements: string[]
  taxEnabled: boolean
  taxRegistrations: string[]
}

export const createConnectedAccount = async ({
  userId,
  companyDetails,
  individual,
  bankDetails,
  businessProfile,
  refreshUrl,
  returnUrl
}: {
  userId: string
  companyDetails: {
    name: string
    address: {
      line1: string
      line2: string
      city: string
      state: string
      postal_code: string
      country: string
    }
    phone: string
    tax_id: string
  }
  individual?: {
    phone?: string
    dob?: {
      day: string
      month: string
      year: string
    }
    relationship?: {
      title?: string
    }
  }
  bankDetails: {
    account_number: string
    country?: string
    currency?: string
    object?: 'bank_account'
    routing_number: string
    account_holder_name?: string
    account_holder_type?: 'individual' | 'company'
  }
  businessProfile?: {
    mcc?: string
    url?: string
    product_description?: string
  }
  refreshUrl: string
  returnUrl: string
}): Promise<CreateConnectedAccountResult> => {
  try {
    let {
      account_number,
      country,
      currency,
      routing_number,
      account_holder_name,
      account_holder_type = 'individual',
      object = 'bank_account'
    } = bankDetails
    const {
      name,
      address,
      phone,
      tax_id
    } = companyDetails
    const stripe = getStripeClient()

    const user = await get<User>({
      tableName: process.env.USERS_TABLE!,
      key: {
        id: userId
      }
    })
    if (user == null) {
      throw new Error('User not found')
    }
    const organization = await get<Organization>({
      tableName: process.env.ORGANIZATIONS_TABLE!,
      key: {
        id: user.organization_id
      }
    })
    if (organization == null) {
      throw new Error('Organization not found')
    }

    // Default country and currency if not provided
    if (!country) {
      country = address.country
    }
    if (country == null) {
      throw new Error('Country is required either in bank details or company address')
    }
    if (!currency) {
      currency = getCurrencyByCountry[country.toUpperCase() as keyof typeof getCurrencyByCountry]?.toLowerCase() || 'usd'
    }
    
    // Validate bank account details
    validateBankAccount(bankDetails, country)
    
    const businessType = account_holder_type === 'individual' ? 'individual' : 'company'
    
    const params: Stripe.AccountCreateParams = {
      business_type: businessType,
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true }
      },
      controller: {
        stripe_dashboard: { type: 'express' },
        fees: {
          payer: 'application'
        },
        losses: {
          payments: 'application',
        },
        requirement_collection: 'stripe'
      },
      country: address.country,
      email: user.email,
      metadata: {
        user_id: userId,
        account_type: businessType,
        creation_timestamp: new Date().toISOString(),
        platform_version: '1.0'
      }
    }
    
    // Add business profile if provided
    if (businessProfile) {
      const profile: Stripe.AccountCreateParams.BusinessProfile = {}
      if (businessProfile.mcc && businessProfile.mcc.trim() !== '') {
        profile.mcc = businessProfile.mcc
      }
      if (businessProfile.url && businessProfile.url.trim() !== '') {
        profile.url = businessProfile.url
      }
      if (businessProfile.product_description && businessProfile.product_description.trim() !== '') {
        profile.product_description = businessProfile.product_description
      }
      // Only add business_profile if it has at least one property
      if (Object.keys(profile).length > 0) {
        params.business_profile = profile
      }
    }
    
    // Ensure business profile exists for setting support address (required for tax calculations)
    if (!params.business_profile) {
      params.business_profile = {}
    }
    
    // Set support address for tax calculations (required for both individual and company accounts)
    params.business_profile.support_address = {
      line1: address.line1,
      city: address.city,
      postal_code: address.postal_code,
      country: address.country
    }
    // Add optional address fields
    if (address.line2) {
      params.business_profile.support_address.line2 = address.line2
    }
    if (address.state) {
      params.business_profile.support_address.state = address.state
    }
    
    // Conditionally add company or individual details based on business type
    if (businessType === 'company') {
      params.company = {
        name,
        address: {
          line1: address.line1,
          city: address.city,
          postal_code: address.postal_code,
          country: address.country
        }
      }
      // Only add optional fields if they have values
      if (address.line2 && params.company.address) {
        params.company.address.line2 = address.line2
      }
      if (address.state && params.company.address) {
        params.company.address.state = address.state
      }
      if (phone) {
        params.company.phone = phone
      }
      if (tax_id) {
        params.company.tax_id = tax_id
      }
    }

    if (businessType === 'individual') {
      params.individual = {
        first_name: user.given_name,
        last_name: user.family_name,
        email: user.email
      }
      
      // Add phone from individual object if provided, otherwise fall back to user.phone_number
      if (individual?.phone) {
        params.individual.phone = individual.phone
      } else if (user.phone_number) {
        params.individual.phone = user.phone_number
      }
      
      // Add date of birth if provided
      if (individual?.dob?.day && individual?.dob?.month && individual?.dob?.year) {
        params.individual.dob = {
          day: parseInt(individual.dob.day),
          month: parseInt(individual.dob.month),
          year: parseInt(individual.dob.year)
        }
      }
      
      // Add relationship title if provided
      if (individual?.relationship?.title) {
        params.individual.relationship = {
          title: individual.relationship.title
        }
      }
      
      // Only add address if we have the required fields
      if (address?.line1 && address?.city && address?.postal_code && country) {
        params.individual.address = {
          line1: address.line1,
          city: address.city,
          postal_code: address.postal_code,
          country
        }
        // Add optional address fields
        if (address.line2) {
          params.individual.address.line2 = address.line2
        }
        if (address.state) {
          params.individual.address.state = address.state
        }
      } else {
        console.warn('Incomplete address provided for individual; skipping address assignment', {
          address
        })
      }
    }

    // Helper functions for tax configuration
    const getTaxCodeForBusiness = (mcc?: string): string => {
      if (!mcc) return 'txcd_10000000' // General - Tangible Goods (default)
      
      // Map common MCCs to appropriate tax codes
      const mccToTaxCode: Record<string, string> = {
        '5734': 'txcd_30070000', // Computer Software
        '5815': 'txcd_30070000', // Digital Goods
        '7372': 'txcd_30070000', // Software Development
        '5411': 'txcd_10000000', // Grocery Stores
        '5812': 'txcd_20030000', // Restaurants
        '5541': 'txcd_11000000', // Gas Stations
        '5651': 'txcd_10000000', // Clothing Stores
        '7991': 'txcd_20030000', // Recreation Services
        '8999': 'txcd_30070000'  // Professional Services
      }
      
      return mccToTaxCode[mcc] || 'txcd_10000000' // Default to tangible goods
    }
    
    // Determine tax behavior based on country
    const getTaxBehavior = (country: string): 'exclusive' | 'inclusive' => {
      // US and Canada typically use exclusive (add tax on top)
      // Most other countries use inclusive (tax included in price)
      const exclusiveCountries = [
        'US',
        'CA'
      ]
      return exclusiveCountries.includes(country.toUpperCase()) ? 'exclusive' : 'inclusive'
    }
    
    // Get required tax registrations based on business location
    const getRequiredRegistrations = (country: string, state?: string) => {
      const registrations: Array<{
        country: string
        country_options: Record<string, {
          [key: string]: unknown
        }>
        active_from: 'now' | number
      }> = []
      
      const countryCode = country.toUpperCase()
      
      switch (countryCode) {
        case 'US':
          if (state) {
            // Create state sales tax registration for US businesses
            registrations.push({
              country: 'US',
              country_options: {
                us: {
                  state: state.toUpperCase(),
                  type: 'state_sales_tax'
                }
              },
              active_from: 'now'
            })
          } else {
            console.warn('US tax registration requires a state - skipping registration')
          }
          break
          
        case 'CA':
          // Always create federal GST/HST registration (simplified)
          registrations.push({
            country: 'CA',
            country_options: {
              ca: {
                type: 'simplified'
              }
            },
            active_from: 'now'
          })
          
          // Add provincial tax registration (PST/RST/QST) if province is specified and applicable
          if (state) {
            const provincesWithPST = [
              'BC', 
              'SK', 
              'MB', 
              'QC'
            ] // BC, Saskatchewan, Manitoba, Quebec
            
            if (provincesWithPST.includes(state.toUpperCase())) {
              registrations.push({
                country: 'CA',
                country_options: {
                  ca: {
                    type: 'province_standard',
                    province_standard: {
                      province: state.toUpperCase()
                    }
                  }
                },
                active_from: 'now'
              })
            }
          } else {
            console.warn('Canada tax registration: province not specified, creating federal GST/HST only')
          }
          break
          
        case 'GB':
          // UK businesses need standard VAT registration
          registrations.push({
            country: 'GB',
            country_options: {
              gb: {
                type: 'standard',
                standard: {
                  place_of_supply_scheme: 'standard'
                }
              }
            },
            active_from: 'now'
          })
          break
          
        case 'AU':
          // Australian businesses need GST registration
          registrations.push({
            country: 'AU',
            country_options: {
              au: {
                type: 'standard',
                standard: {
                  place_of_supply_scheme: 'standard'
                }
              }
            },
            active_from: 'now'
          })
          break
          
        // EU countries - standard VAT registration with standard place of supply scheme
        case 'DE':
        case 'FR':
        case 'IT':
        case 'ES':
        case 'NL':
        case 'IE':
        case 'AT':
        case 'BE':
        case 'BG':
        case 'CY':
        case 'CZ':
        case 'DK':
        case 'EE':
        case 'FI':
        case 'GR':
        case 'HR':
        case 'HU':
        case 'LT':
        case 'LU':
        case 'LV':
        case 'MT':
        case 'PL':
        case 'PT':
        case 'RO':
        case 'SE':
        case 'SI':
        case 'SK':
          registrations.push({
            country: countryCode,
            country_options: {
              [countryCode.toLowerCase()]: {
                type: 'standard',
                standard: {
                  place_of_supply_scheme: 'standard'
                }
              }
            },
            active_from: 'now'
          })
          break
          
        // Countries with simplified tax registration
        case 'IN':
        case 'MY':
        case 'TH':
        case 'ID':
        case 'PH':
        case 'VN':
        case 'KR':
        case 'MX':
        case 'CL':
        case 'CO':
        case 'PE':
        case 'SA':
        case 'TR':
        case 'RU':
        case 'UA':
        case 'EG':
        case 'KE':
        case 'NG':
        case 'MA':
          registrations.push({
            country: countryCode,
            country_options: {
              [countryCode.toLowerCase()]: {
                type: 'simplified'
              }
            },
            active_from: 'now'
          })
          break
          
        // Countries with standard registration and place of supply scheme
        case 'JP':
        case 'SG':
        case 'CH':
        case 'NO':
        case 'NZ':
        case 'ZA':
        case 'IS':
          registrations.push({
            country: countryCode,
            country_options: {
              [countryCode.toLowerCase()]: {
                type: 'standard',
                standard: {
                  place_of_supply_scheme: 'standard'
                }
              }
            },
            active_from: 'now'
          })
          break
          
        default:
          console.warn(`Tax registration for country ${countryCode} not configured - skipping automatic registration`)
          break
      }
      
      return registrations
    }

    const account = await stripe.accounts.create(params)
    
    // Enable comprehensive Stripe Tax configuration for the connected account
    let taxEnabled = false
    try {
      
      const taxCode = getTaxCodeForBusiness(businessProfile?.mcc)
      const taxBehavior = getTaxBehavior(address.country)
      
      const headOfficeAddress: Record<string, string> = {
        line1: address.line1,
        city: address.city,
        state: address.state,
        postal_code: address.postal_code,
        country: address.country
      }
      
      // Add line2 if provided
      if (address.line2) {
        headOfficeAddress.line2 = address.line2
      }
      
      const taxSettings = {
        defaults: {
          tax_code: taxCode,
          tax_behavior: taxBehavior
        },
        head_office: {
          address: headOfficeAddress
        }
      }
      
      await stripe.tax.settings.update(taxSettings, {
        stripeAccount: account.id
      })
      
      taxEnabled = true
      console.log(`Tax settings configured for connected account: ${account.id}`)
      console.log(`- Tax code: ${taxCode}`)
      console.log(`- Tax behavior: ${taxBehavior}`)
      console.log(`- Head office: ${address.city}, ${address.country}`)
      
    } catch (taxError) {
      console.warn('Failed to configure tax settings for connected account:', taxError)
      // Continue with account creation even if tax setup fails
    }
    
    // Create automatic tax registrations for common jurisdictions
    const taxRegistrations: string[] = []
    if (taxEnabled) {
      try {
        const registrationsToCreate = getRequiredRegistrations(address.country, address.state)
        
        for (const registration of registrationsToCreate) {
          try {
            const taxRegistration = await stripe.tax.registrations.create(registration, {
              stripeAccount: account.id
            })
            taxRegistrations.push(`${taxRegistration.country}:${taxRegistration.id}`)
            console.log(`Created tax registration: ${taxRegistration.country} (${taxRegistration.id})`)
          } catch (regError) {
            console.warn(`Failed to create tax registration for ${registration.country}:`, regError)
            // Continue with other registrations even if one fails
          }
        }
      } catch (error) {
        console.warn('Failed to create tax registrations:', error)
        // Continue with account creation even if registrations fail
      }
    }
    
    if (!country) {
      throw new Error('Country is required for bank account')
    }
    
    // Create external account with proper typing
    const externalAccountParams: Stripe.AccountCreateExternalAccountParams = {
      external_account: {
        object,
        account_number,
        country,
        currency,
        account_holder_name: account_holder_name || (businessType === 'individual' ? `${user.given_name} ${user.family_name}` : name),
        account_holder_type,
        ...(routing_number ? { routing_number } : {})
      }
    }

    const bankAccount = await stripe.accounts.createExternalAccount(account.id, externalAccountParams)

    // Check account requirements and status
    const accountWithRequirements = await stripe.accounts.retrieve(account.id)
    const requiresOnboarding = !accountWithRequirements.charges_enabled || 
                              (accountWithRequirements.requirements?.currently_due?.length || 0) > 0 ||
                              (accountWithRequirements.requirements?.eventually_due?.length || 0) > 0
    
    let onboardingUrl: string | undefined
    if (requiresOnboarding) {
      const accountLink = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding'
      })
      onboardingUrl = accountLink.url
    }
    if (currency == null) currency = account.default_currency

    await update<Organization>({
      tableName: process.env.ORGANIZATIONS_TABLE!,
      key: {
        id: organization.id
      },
      updates: {
        stripe_account_id: account.id,
        stripe_bank_account_id: bankAccount.id,
        onboarding_url: onboardingUrl,
        onboarding_status: requiresOnboarding ? 'in_progress' : 'completed',
        missing_requirements: [
          ...(accountWithRequirements.requirements?.currently_due || []),
          ...(accountWithRequirements.requirements?.eventually_due || [])
        ],
        charges_enabled: accountWithRequirements.charges_enabled,
        payouts_enabled: accountWithRequirements.payouts_enabled,
        onboarding_completed_at: !requiresOnboarding ? new Date().toISOString() : undefined,
        tax_enabled: taxEnabled,
        tax_settings: taxEnabled ? {
          tax_code: getTaxCodeForBusiness(businessProfile?.mcc),
          tax_behavior: getTaxBehavior(address.country),
          head_office_country: address.country
        } : undefined,
        tax_registrations: taxRegistrations.length > 0 ? taxRegistrations : undefined,
        ...(currency ? { currency } : {})
      }
    })
    
    return {
      account: accountWithRequirements,
      onboardingUrl,
      requiresOnboarding,
      missingRequirements: [
        ...(accountWithRequirements.requirements?.currently_due || []),
        ...(accountWithRequirements.requirements?.eventually_due || [])
      ],
      taxEnabled,
      taxRegistrations
    }
  } catch (error: unknown) {
    handleStripeError(error)
    throw error // This line won't execute due to handleStripeError throwing, but TypeScript needs it
  }
}