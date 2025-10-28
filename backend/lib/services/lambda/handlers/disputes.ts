import { unmarshall } from '@aws-sdk/util-dynamodb'
import { disputesTableName } from '@marketplace/constants'
import { Dispute } from '@marketplace/types'
import { DynamoDBStreamEvent } from 'aws-lambda'
import { processDisputeRefund } from '../helpers/disputes/process-dispute-refund'
import { updatePurchaseDisputeStatus } from '../helpers/disputes/update-purchase-dispute-status'
import { update } from '../helpers/dynamo-helpers/update'
import { formatCurrency } from '../helpers/emails/collect-receipt-data'
import { createNotification } from '../helpers/notifications/internal-notifications/create-notification'

/**
 * DynamoDB Stream handler for disputes table
 * Handles automatic refund processing when disputes are accepted
 */
export const disputes = async (event: DynamoDBStreamEvent) => {
  for (const record of event.Records) {
    if (record.eventName === 'MODIFY' && record.dynamodb?.NewImage && record.dynamodb?.OldImage) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const oldDispute = unmarshall(record.dynamodb.OldImage as any) as Dispute
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newDispute = unmarshall(record.dynamodb.NewImage as any) as Dispute

      // Check if status changed to 'accepted'
      if (oldDispute.status !== 'accepted' && newDispute.status === 'accepted') {
        try {
          // Process refunds for all purchases in the dispute
          const refundResult = await processDisputeRefund({
            purchaseIds: newDispute.purchase_ids,
            userId: newDispute.buyer_user_id
          })

          // Update dispute with refund information
          await update<Dispute>({
            tableName: disputesTableName!,
            key: {
              id: newDispute.id,
              created_at: newDispute.created_at
            },
            updates: {
              refund_ids: refundResult.refundIds,
              refunded_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          })

          // Notify buyer of successful refund
          await createNotification({
            type: 'refund_processed',
            user_id: newDispute.buyer_user_id,
            title: 'Refund Processed',
            message: `Your dispute has been resolved and a refund of ${formatCurrency(refundResult.totalRefunded, newDispute.currency)} has been processed to your original payment method.`,
            metadata: {
              dispute_id: newDispute.id,
              refund_amount: refundResult.totalRefunded.toString(),
              currency: newDispute.currency
            }
          })

        } catch (error) {
          console.error(`Failed to process refunds for dispute ${newDispute.id}:`, error)

          // Notify buyer of refund failure
          try {
            await createNotification({
              type: 'refund_failed',
              user_id: newDispute.buyer_user_id,
              title: 'Refund Processing Issue',
              message: 'There was an issue processing your refund. Our support team has been notified and will contact you shortly.',
              metadata: {
                dispute_id: newDispute.id,
                error: 'refund_processing_failed'
              }
            })
          } catch (notificationError) {
            console.error('Failed to send refund failure notification:', notificationError)
          }

          // TODO: Alert platform admin team about refund failure
          // This is critical and needs manual intervention
        }
      }

      // Check if status changed to 'rejected'
      if (oldDispute.status !== 'rejected' && newDispute.status === 'rejected') {
        try {
          // Update all purchases with rejected dispute status
          await updatePurchaseDisputeStatus({
            purchaseIds: newDispute.purchase_ids,
            userId: newDispute.buyer_user_id,
            disputeStatus: 'rejected'
          })
        } catch (error) {
          console.error(`Failed to update purchases for rejected dispute ${newDispute.id}:`, error)
        }
      }

      // Check if status changed to 'escalated'
      if (oldDispute.status !== 'escalated' && newDispute.status === 'escalated') {
        try {
          // Update all purchases with escalated dispute status
          await updatePurchaseDisputeStatus({
            purchaseIds: newDispute.purchase_ids,
            userId: newDispute.buyer_user_id,
            disputeStatus: 'escalated'
          })
        } catch (error) {
          console.error(`Failed to update purchases for escalated dispute ${newDispute.id}:`, error)
        }
      }

      // Check if status changed to 'resolved'
      if (oldDispute.status !== 'resolved' && newDispute.status === 'resolved') {
        try {
          // Update all purchases with resolved dispute status
          await updatePurchaseDisputeStatus({
            purchaseIds: newDispute.purchase_ids,
            userId: newDispute.buyer_user_id,
            disputeStatus: 'resolved'
          })
        } catch (error) {
          console.error(`Failed to update purchases for resolved dispute ${newDispute.id}:`, error)
        }
      }
    }

    // Log dispute creation for monitoring
    if (record.eventName === 'INSERT' && record.dynamodb?.NewImage) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newDispute = unmarshall(record.dynamodb.NewImage as any) as Dispute
      // Set initial dispute status on purchases
      try {
        await updatePurchaseDisputeStatus({
          purchaseIds: newDispute.purchase_ids,
          userId: newDispute.buyer_user_id,
          disputeStatus: 'pending'
        })
      } catch (error) {
        console.error(`Failed to set initial dispute status for new dispute ${newDispute.id}:`, error)
      }
    }
  }
}
