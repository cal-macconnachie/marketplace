import { getStripeClient } from './stripe-client'
import { User } from '../../handlers/users'
import Stripe from 'stripe'

export const cloneCustomerToConnectedAccount = async ({
  user,
  connectedAccountId
}: {
  user: User
  connectedAccountId: string
}): Promise<string> => {
  const stripe = getStripeClient()
  
  try {
    // Get the original customer from platform account
    if (!user.stripe_id) {
      throw new Error('User does not have a Stripe customer ID')
    }

    const platformCustomer = await stripe.customers.retrieve(user.stripe_id)
    
    if (platformCustomer.deleted) {
      throw new Error('Platform customer has been deleted')
    }

    // Create customer on connected account with same details
    const customerParams: Stripe.CustomerCreateParams = {
      name: platformCustomer.name || `${user.given_name || ''} ${user.family_name || ''}`.trim() || undefined,
      email: platformCustomer.email || user.email,
      phone: platformCustomer.phone || user.phone_number,
      address: platformCustomer.address ? {
        line1: platformCustomer.address.line1 ?? undefined,
        line2: platformCustomer.address.line2 ?? undefined,
        city: platformCustomer.address.city ?? undefined,
        state: platformCustomer.address.state ?? undefined,
        postal_code: platformCustomer.address.postal_code ?? undefined,
        country: platformCustomer.address.country ?? undefined
      } : (user.address ? {
        line1: user.address.line_1,
        line2: user.address.line_2,
        city: user.address.city,
        state: user.address.state,
        postal_code: user.address.postal_code,
        country: user.address.country
      } : undefined),
      metadata: {
        platform_customer_id: user.stripe_id,
        user_id: user.id,
        organization_id: user.organization_id,
        cloned_at: new Date().toISOString()
      }
    }

    const connectedCustomer = await stripe.customers.create(customerParams, {
      stripeAccount: connectedAccountId
    })

    return connectedCustomer.id
  } catch (error) {
    throw new Error(`Failed to clone customer to connected account: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}