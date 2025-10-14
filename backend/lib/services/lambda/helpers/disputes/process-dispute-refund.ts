import { purchasesTableName } from '@marketplace/constants'
import { Purchase } from '@marketplace/types'
import Stripe from 'stripe'
import { get } from '../dynamo-helpers/get'
import { update } from '../dynamo-helpers/update'
import { getStripeClient } from '../stripe/stripe-client'

/**
 * Process refunds for disputed purchases
 * Handles both one-time payments and subscriptions with destination charges
 */
export async function processDisputeRefund(params: {
  purchaseIds: string[]
  userId: string
}): Promise<{
  refundIds: string[]
  totalRefunded: number
}> {
  const {
    purchaseIds, userId 
  } = params
  const stripe = getStripeClient()
  const refundIds: string[] = []
  let totalRefunded = 0

  for (const purchaseId of purchaseIds) {
    try {
      // Get purchase details
      const purchase = await get<Purchase>({
        tableName: purchasesTableName!,
        key: {
          user_id: userId,
          id: purchaseId
        }
      })

      if (!purchase) {
        console.error(`Purchase ${purchaseId} not found`)
        continue
      }

      // Skip if already refunded
      if (purchase.status === 'refunded' || purchase.refund_id) {
        console.log(`Purchase ${purchaseId} already refunded`)
        continue
      }

      const refundAmount = purchase.amount

      // Create refund in Stripe
      // For destination charges, the refund comes from the connected account
      let refund: Stripe.Refund

      if (purchase.destination_charge_id && purchase.connected_account_id) {
        // Destination charge refund
        // The platform fee is reversed and comes from the seller's account
        refund = await stripe.refunds.create(
          {
            charge: purchase.destination_charge_id,
            amount: refundAmount,
            refund_application_fee: true, // Refund the platform fee
            reverse_transfer: false, // Don't reverse the transfer (already distributed)
            metadata: {
              purchase_id: purchaseId,
              dispute_refund: 'true'
            }
          },
          {
            stripeAccount: purchase.connected_account_id
          }
        )
      } else {
        // Direct charge refund (shouldn't happen in marketplace model, but handle it)
        console.warn(`Purchase ${purchaseId} has no destination charge - processing as direct refund`)

        // We need to find the payment intent or charge ID
        // This would typically be stored on the purchase
        // For now, we'll skip if we don't have the charge ID
        console.error(`Cannot process refund for purchase ${purchaseId}: missing charge information`)
        continue
      }

      console.log(`Refund created: ${refund.id} for purchase ${purchaseId}, amount: ${refundAmount}`)

      // Update purchase record
      await update<Purchase>({
        tableName: purchasesTableName!,
        key: {
          user_id: userId,
          id: purchaseId
        },
        updates: {
          status: 'refunded',
          refund_amount: refundAmount,
          refund_id: refund.id,
          refunded_at: new Date().toISOString()
        }
      })

      refundIds.push(refund.id)
      totalRefunded += refundAmount

    } catch (error) {
      console.error(`Error processing refund for purchase ${purchaseId}:`, error)
      // Continue with other purchases even if one fails
    }
  }

  return {
    refundIds,
    totalRefunded
  }
}
