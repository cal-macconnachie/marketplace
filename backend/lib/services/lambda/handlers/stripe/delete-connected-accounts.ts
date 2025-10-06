import { getStripeClient } from '../../helpers/stripe/stripe-client'

export const deleteConnectedAccounts = async ({
  accountIds
}: {
  accountIds: string[]
}): Promise<void> => {
  const stripe = getStripeClient()
  try {
    for (const accountId of accountIds) {
      try {
        await stripe.accounts.del(accountId)
      } catch (error) {
        console.error(`Error deleting connected account ${accountId}:`, error)
      }
    }
  } catch (error) {
    console.error('Error deleting connected accounts:', error)
  }
}
