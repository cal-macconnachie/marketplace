import { purchasesTableName } from '@marketplace/constants'
import { Purchase } from '@marketplace/types'
import Stripe from 'stripe'
import { get } from '../dynamo-helpers/get'
import { getStripeClient } from '../stripe/stripe-client'
import { refundPurchase } from '../purchases/refund-purchase'

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
      // Refund the original platform charge to send money back to customer's card
      // The connected account still owes the platform fee
      let refund: Stripe.Refund

      if (purchase.destination_charge_id) {
        // Refund the platform charge (the original charge from the customer)
        // This sends money back to the customer's card
        // reverse_transfer: true pulls the funds back from the connected account
        // refund_application_fee: false means the connected account keeps the platform fee debt
        refund = await stripe.refunds.create({
          charge: purchase.destination_charge_id, // Original platform charge
          amount: refundAmount,
          reverse_transfer: true, // Pull funds back from connected account
          refund_application_fee: false, // Connected account still owes platform fee
          metadata: {
            purchase_id: purchaseId,
            dispute_refund: 'true'
          }
        })
      } else {
        // Missing charge ID
        console.error(`Cannot process refund for purchase ${purchaseId}: missing destination_charge_id`)
        continue
      }

      console.log(`Refund created: ${refund.id} for purchase ${purchaseId}, amount: ${refundAmount}`)

      // Update purchase record with refund details (single DB update)
      await refundPurchase({
        purchase,
        refundId: refund.id,
        refundAmount,
        disputeRefund: true
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
