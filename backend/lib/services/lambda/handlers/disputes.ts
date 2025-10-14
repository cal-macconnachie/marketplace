import { unmarshall } from '@aws-sdk/util-dynamodb'
import { disputesTableName } from '@marketplace/constants'
import { Dispute } from '@marketplace/types'
import { DynamoDBStreamEvent } from 'aws-lambda'
import { processDisputeRefund } from '../helpers/disputes/process-dispute-refund'
import { update } from '../helpers/dynamo-helpers/update'
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
        console.log(`Dispute ${newDispute.id} was accepted - processing refunds`)

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
            message: `Your dispute has been resolved and a refund of ${refundResult.totalRefunded / 100} ${newDispute.currency} has been processed to your original payment method.`,
            metadata: {
              dispute_id: newDispute.id,
              refund_amount: refundResult.totalRefunded.toString(),
              currency: newDispute.currency
            }
          })

          console.log(`Successfully processed ${refundResult.refundIds.length} refunds for dispute ${newDispute.id}`)

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
    }

    // Log dispute creation for monitoring
    if (record.eventName === 'INSERT' && record.dynamodb?.NewImage) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newDispute = unmarshall(record.dynamodb.NewImage as any) as Dispute
      console.log(`New dispute created: ${newDispute.id} for ${newDispute.purchase_ids.length} purchases, amount: ${newDispute.total_dispute_amount}`)
    }
  }
}
