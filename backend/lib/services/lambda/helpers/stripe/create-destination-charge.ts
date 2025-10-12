import {
  paymentMethodsTableName
} from '@marketplace/constants'
import {
  PaymentMethod,
  User
} from '@marketplace/types'
import {
  get
} from '../dynamo-helpers/get'
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

  // Get payment method to check if it's verified on-session
  const paymentMethod = await get<PaymentMethod>({
    tableName: paymentMethodsTableName!,
    key: {
      user_id: user.id,
      id: paymentMethodId
    }
  })

  if (!paymentMethod) {
    throw new Error('Payment method not found')
  }

  // Create metadata object with cart and product info
  const metadata: Record<string, string> = {}
  if (cartId) {
    metadata.cart_id = cartId
  }
  if (purchaseIds && purchaseIds.length > 0) {
    metadata.purchase_ids = JSON.stringify(purchaseIds)
  }
  metadata.user_id = user.id

  // Create and confirm payment intent in one call
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
    confirm: true, // Auto-confirm
    off_session: paymentMethod.verified_on_session ?? false, // Use off_session if verified
    ...(Object.keys(metadata).length > 0 ? { metadata } : {})
  })

  if (!paymentIntent) {
    throw new Error('Failed to create payment intent')
  }

  // Check if additional action is required (3DS)
  if (paymentIntent.status === 'requires_action') {
    console.log(`PaymentIntent ${paymentIntent.id} requires additional action (3DS)`)

    // Don't throw error - return PaymentIntent so webhook can handle requires_action
    // The Purchase record will be created with status='pending' and requires_action data
    return paymentIntent
  }

  if (paymentIntent.status === 'requires_payment_method') {
    throw new Error('Payment method declined. Please use a different payment method.')
  }

  if (paymentIntent.status === 'requires_confirmation') {
    // This shouldn't happen with confirm: true, but handle just in case
    return await stripe.paymentIntents.confirm(paymentIntent.id)
  }

  if (paymentIntent.status !== 'succeeded' && paymentIntent.status !== 'requires_capture') {
    throw new Error(`Payment failed with status: ${paymentIntent.status}`)
  }

  return paymentIntent
}
