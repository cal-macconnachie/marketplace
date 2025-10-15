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

      if (purchase.transfer_id && purchase.connected_account_id) {
        // Destination charge refund using transfer_id (preferred method)
        // Get the transfer to find the destination charge ID
        const transfer = await stripe.transfers.retrieve(purchase.transfer_id)
        const destinationChargeId = typeof transfer.destination_payment === 'string'
          ? transfer.destination_payment
          : transfer.destination_payment?.id

        if (!destinationChargeId) {
          console.error(`Cannot process refund for purchase ${purchaseId}: transfer has no destination_payment`)
          continue
        }

        // The platform fee is reversed and comes from the seller's account
        refund = await stripe.refunds.create(
          {
            charge: destinationChargeId, // Use the connected account's charge ID
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
      } else if (purchase.destination_charge_id && purchase.connected_account_id) {
        // Fallback: try to find transfer from platform charge (legacy support)
        console.warn(`Purchase ${purchaseId} has no transfer_id, attempting to find transfer from destination_charge_id`)

        try {
          const platformCharge = await stripe.charges.retrieve(purchase.destination_charge_id)
          const transferId = typeof platformCharge.transfer === 'string'
            ? platformCharge.transfer
            : platformCharge.transfer?.id

          if (!transferId) {
            console.error(`Cannot process refund for purchase ${purchaseId}: charge has no transfer`)
            continue
          }

          const transfer = await stripe.transfers.retrieve(transferId)
          const destinationChargeId = typeof transfer.destination_payment === 'string'
            ? transfer.destination_payment
            : transfer.destination_payment?.id

          if (!destinationChargeId) {
            console.error(`Cannot process refund for purchase ${purchaseId}: transfer has no destination_payment`)
            continue
          }

          refund = await stripe.refunds.create(
            {
              charge: destinationChargeId,
              amount: refundAmount,
              refund_application_fee: true,
              reverse_transfer: false,
              metadata: {
                purchase_id: purchaseId,
                dispute_refund: 'true'
              }
            },
            {
              stripeAccount: purchase.connected_account_id
            }
          )
        } catch (error) {
          console.error(`Failed to process refund via destination_charge_id for purchase ${purchaseId}:`, error)
          continue
        }
      } else {
        // Direct charge refund (shouldn't happen in marketplace model, but handle it)
        console.error(`Cannot process refund for purchase ${purchaseId}: missing transfer_id and destination_charge_id`)
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
