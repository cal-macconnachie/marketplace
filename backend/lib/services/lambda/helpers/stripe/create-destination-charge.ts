import {
  paymentMethodsTableName
} from '@marketplace/constants'
import {
  PaymentMethod,
  User
} from '@marketplace/types'
import Stripe from 'stripe'
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
  purchaseIds,
  fullAmountToDestination = false
}: {
  amount: number
  currency: string
  paymentMethodId: string
  user: User
  destinationAccountId: string
  cartId?: string
  purchaseIds?: string[]
  fullAmountToDestination?: boolean
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

  // Calculate platform fee and adjust amount if needed
  let chargeAmount = amount
  let platformFee: number

  if (fullAmountToDestination) {
    // When fullAmountToDestination is true, the amount parameter represents
    // what the destination should receive. We need to add the platform fee
    // to the charge amount so the destination gets the full amount after fees.
    platformFee = await calculatePlatformFee({
      amount,
      organizationId: user.organization_id
    })
    chargeAmount = amount + platformFee
  } else {
    // Default behavior: amount is the total charge, fee is deducted from it
    platformFee = await calculatePlatformFee({
      amount,
      organizationId: user.organization_id
    })
  }

  try {
    // Create and confirm payment intent in one call
    // Treat all charges as on-session to allow 3DS authentication
    const paymentIntent = await stripe.paymentIntents.create({
      amount: chargeAmount,
      currency,
      customer: user.stripe_id,
      payment_method: paymentMethodId,
      transfer_data: {
        destination: destinationAccountId
      },
      application_fee_amount: platformFee,
      on_behalf_of: destinationAccountId,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never' as const
      },
      confirm: true, // Auto-confirm
      // Omit off_session to treat as on-session (customer present) - allows 3DS
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
  } catch (error) {
    // Check if this is a Stripe error with a PaymentIntent that requires authentication
    if (error && typeof error === 'object' && 'type' in error && error.type === 'StripeCardError') {
      const stripeError = error as Stripe.errors.StripeCardError

      // If the error contains a payment_intent, check if it needs authentication
      if (stripeError.payment_intent) {
        const paymentIntent = stripeError.payment_intent

        // If the PaymentIntent requires action (authentication), return it so we can handle it
        if (paymentIntent.status === 'requires_action' && paymentIntent.client_secret) {
          console.log(`PaymentIntent ${paymentIntent.id} requires authentication (from error), returning for 3DS flow`)
          return paymentIntent
        }
      }

      // Check decline_code for authentication_required
      if (stripeError.decline_code === 'authentication_required') {
        console.log('Payment declined with authentication_required, error contains:', {
          hasPaymentIntent: !!stripeError.payment_intent,
          paymentIntentStatus: stripeError.payment_intent?.status,
          hasClientSecret: !!stripeError.payment_intent?.client_secret
        })
      }
    }

    // Re-throw the error if we can't handle it
    throw error
  }
}
