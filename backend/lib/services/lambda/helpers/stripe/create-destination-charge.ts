import { User } from '@marketplace/types'
import { calculatePlatformFee } from './calculate-platform-fee'
import { getStripeClient } from './stripe-client'

export const createDestinationCharge = async ({
  amount,
  currency,
  paymentMethodId,
  user,
  destinationAccountId,
  cartId,
  purchaseIds
}: {
  amount: number
  currency: string
  paymentMethodId: string
  user: User
  destinationAccountId: string
  cartId?: string
  purchaseIds?: string[]
}) => {
  const stripe = getStripeClient()

  // Create metadata object with cart and product info
  const metadata: Record<string, string> = {}
  if (cartId) {
    metadata.cart_id = cartId
  }
  if (purchaseIds && purchaseIds.length > 0) {
    metadata.purchase_ids = JSON.stringify(purchaseIds)
  }
  metadata.user_id = user.id

  // Create a new payment intent for the destination charge
  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency,
    customer: user.stripe_id,
    payment_method: paymentMethodId,
    transfer_data: {
      destination: destinationAccountId
    },
    application_fee_amount: await calculatePlatformFee({
      amount,
      organizationId: user.organization_id
    }),
    on_behalf_of: destinationAccountId,
    automatic_payment_methods: {
      enabled: true,
      allow_redirects: 'never' as const
    },
    ...(Object.keys(metadata).length > 0 ? { metadata } : {})
  })
  if (!paymentIntent) {
    throw new Error('Failed to create payment intent')
  }
  const confirmedPaymentIntent = await stripe.paymentIntents.confirm(paymentIntent.id, {})

  return confirmedPaymentIntent
}
