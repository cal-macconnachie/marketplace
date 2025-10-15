import { purchasesTableName } from '@marketplace/constants'
import { Purchase } from '@marketplace/types'
import { update } from '../dynamo-helpers/update'

/**
 * Refunds a purchase by zeroing out amounts (while preserving originals) and recording refund details.
 * Combines amount adjustment logic with refund tracking in a single database update.
 */
export const refundPurchase = async (params: {
  purchase: Purchase
  refundId: string
  refundAmount: number
  disputeRefund?: boolean
}): Promise<Purchase> => {
  const {
    purchase, refundId, refundAmount, disputeRefund = false 
  } = params

  // Calculate the original values (same logic as adjust-purchase-amount.ts)
  const originalTotal = purchase.amount
  const originalBaseAmount = purchase.base_amount ?? (purchase.amount - (purchase.tax_amount ?? 0))
  const originalTaxAmount = purchase.tax_amount ?? 0
  const originalPlatformFeeAmount = purchase.platform_fee_amount ?? 0

  const now = new Date().toISOString()

  // Update the purchase record with refund details and zeroed amounts
  const updatedPurchase = await update<Purchase>({
    tableName: purchasesTableName!,
    key: {
      user_id: purchase.user_id,
      id: purchase.id
    },
    updates: {
      status: 'refunded',
      // Preserve original amounts for audit trail
      original_amount: purchase.original_amount ?? originalTotal,
      original_base_amount: purchase.original_base_amount ?? originalBaseAmount,
      original_tax_amount: originalTaxAmount,
      original_platform_fee_amount: originalPlatformFeeAmount,
      // Zero out current amounts since fully refunded
      amount: 0,
      base_amount: 0,
      tax_amount: 0,
      // NOTE: platform_fee_amount is NOT zeroed out - connected account still owes the platform fee
      // Track refund details
      refund_amount: refundAmount,
      refund_id: refundId,
      refunded_at: now,
      // Mark dispute status if this is a dispute refund
      ...(disputeRefund && {
        dispute_status: 'accepted',
        dispute_resolved_at: now
      })
    },
    returnUpdated: true
  })

  return updatedPurchase
}
