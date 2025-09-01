import Stripe from 'stripe'
import { User } from '../../handlers/users'
import { get } from '../dynamo-helpers/get'
import { getStripeClient } from './stripe-client'
import { update } from '../dynamo-helpers/update'
import getCurrencyByCountry from 'country-to-currency'

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
}

export const createConnectedAccount = async ({
  userId,
  companyDetails,
  bankDetails,
  businessProfile,
  controllerSettings,
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
  controllerSettings?: {
    fees_payer?: 'account' | 'application'
    losses_payer?: 'account' | 'application'
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

    // Default country and currency if not provided
    if (!country) {
      country = user?.address?.country || address.country
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
        fees: { payer: controllerSettings?.fees_payer || 'account' },
        losses: { payments: 'application' },
        stripe_dashboard: { type: 'express' },
        requirement_collection: 'stripe'
      },
      country: address.country,
      email: user.email,
      type: 'express',
      metadata: {
        user_id: userId,
        account_type: businessType,
        creation_timestamp: new Date().toISOString(),
        platform_version: '1.0'
      }
    }
    
    // Add business profile if provided
    if (businessProfile) {
      params.business_profile = {
        mcc: businessProfile.mcc,
        url: businessProfile.url,
        product_description: businessProfile.product_description
      }
    }
    
    // Conditionally add company or individual details based on business type
    if (businessType === 'company') {
      params.company = {
        name,
        address: {
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          state: address.state,
          postal_code: address.postal_code,
          country: address.country
        },
        phone: phone,
        tax_id: tax_id
      }
    }

    if (businessType === 'individual') {
      params.individual = {
        first_name: user.given_name,
        last_name: user.family_name,
        email: user.email,
        phone: user.phone_number,
        address: {
          line1: user.address?.line_1,
          line2: user.address?.line_2,
          city: user.address?.city,
          state: user.address?.state,
          postal_code: user.address?.postal_code,
          country: user.address?.country
        }
      }
    }

    const account = await stripe.accounts.create(params)
    
    if (!country) {
      throw new Error('Country is required for bank account')
    }
    
    const bankAccount = await stripe.accounts.createExternalAccount(account.id, {
      external_account: {
        object,
        account_number,
        country,
        currency,
        routing_number,
        account_holder_name: account_holder_name || (businessType === 'individual' ? `${user.given_name} ${user.family_name}` : name),
        account_holder_type
      }
    })
    
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
    
    await update<User>({
      tableName: process.env.USERS_TABLE!,
      key: {
        id: userId
      },
      updates: {
        stripe_account_id: account.id,
        stripe_bank_account_id: bankAccount.id
      }
    })
    
    return {
      account: accountWithRequirements,
      onboardingUrl,
      requiresOnboarding,
      missingRequirements: [
        ...(accountWithRequirements.requirements?.currently_due || []),
        ...(accountWithRequirements.requirements?.eventually_due || [])
      ]
    }
  } catch (error: unknown) {
    handleStripeError(error)
    throw error // This line won't execute due to handleStripeError throwing, but TypeScript needs it
  }
}