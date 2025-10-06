import { getStripeClient } from './stripe-client'

export interface CreateLoginLinkParams {
  connectedAccountId: string
}

export const createLoginLink = async ({ connectedAccountId }: CreateLoginLinkParams) => {
  const stripe = getStripeClient()
  
  try {
    const loginLink = await stripe.accounts.createLoginLink(connectedAccountId)
    
    return {
      url: loginLink.url,
      created: loginLink.created
    }
  } catch (error) {
    console.error('Error creating login link:', error)
    throw error
  }
}