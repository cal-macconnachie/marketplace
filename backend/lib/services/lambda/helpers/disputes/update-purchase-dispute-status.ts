import { purchasesTableName } from '@marketplace/constants'
import { Purchase } from '@marketplace/types'
import { update } from '../dynamo-helpers/update'

/**
 * Update the dispute status on all purchases involved in a dispute
 */
export async function updatePurchaseDisputeStatus(params: {
  purchaseIds: string[]
  userId: string
  disputeStatus: 'pending' | 'accepted' | 'rejected' | 'escalated' | 'resolved'
}): Promise<void> {
  const {
    purchaseIds, userId, disputeStatus 
  } = params
  const now = new Date().toISOString()

  for (const purchaseId of purchaseIds) {
    try {
      await update<Purchase>({
        tableName: purchasesTableName!,
        key: {
          user_id: userId,
          id: purchaseId
        },
        updates: {
          dispute_status: disputeStatus,
          dispute_resolved_at: disputeStatus !== 'pending' ? now : undefined
        }
      })

      console.log(`Updated purchase ${purchaseId} dispute status to: ${disputeStatus}`)
    } catch (error) {
      console.error(`Failed to update dispute status for purchase ${purchaseId}:`, error)
      // Continue with other purchases
    }
  }
}
