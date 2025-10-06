import {
  DynamoDBStreamEvent, DynamoDBRecord 
} from 'aws-lambda'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { putEvents } from '../helpers/eventbridge/put-events'
import { Cart } from '@marketplace/types'

// Helper function to get all purchases for a cart

export const handler = async (event: DynamoDBStreamEvent) => {
  for (const record of event.Records) {
    await processRecord(record)
  }
}

const processRecord = async (record: DynamoDBRecord) => {
  // Only process MODIFY events (when items are updated)
  if (record.eventName !== 'MODIFY') {
    return
  }

  if (!record.dynamodb?.NewImage || !record.dynamodb?.OldImage) {
    return
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newCart = unmarshall(record.dynamodb.NewImage as any) as Cart
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const oldCart = unmarshall(record.dynamodb.OldImage as any) as Cart
    const hasPurchases = Object.keys(newCart.purchases || {}).length > 0
    if (!hasPurchases) {
      return
    }
    const hasNewPendingPurchases = Object.keys(newCart.purchases).some((purchaseId) => {
      const oldPurchases = oldCart.purchases ?? {}
      const oldStatus = oldPurchases[purchaseId]
      const newStatus = newCart.purchases[purchaseId]
      return newStatus === 'pending' && oldStatus == null
    })
    if (hasNewPendingPurchases) {
      await putEvents({
        events: [
          {
            Source: 'purchase-carts-stream',
            DetailType: 'pending-purchases-added',
            Detail: JSON.stringify({
              purchase_keys: Object.keys(newCart.purchases).filter((purchaseId) => {
                const oldStatus = oldCart.purchases?.[purchaseId]
                const newStatus = newCart.purchases[purchaseId]
                return newStatus === 'pending' && oldStatus == null
              }).map(id => {
                return {
                  user_id: newCart.user_id,
                  id
                }
              })
            })
          }
        ]
      })
    }
    // Check if any items were marked as processed (true or false)
    const hasNewProcessedItems = Object.keys(newCart.purchases).some((purchaseId) => {
      const oldStatus = oldCart.purchases[purchaseId]
      const newStatus = newCart.purchases[purchaseId]
      if (oldStatus && oldStatus !== newStatus && (newStatus === 'completed' || newStatus === 'failed')) {
        return true
      }
      return false
    })

    if (!hasNewProcessedItems) {
      return
    }

    // Check if all items are now processed (either success=true or fail=false)
    const allItemsProcessed = newCart.purchases && Object.values(newCart.purchases).every(status => status === 'completed' || status === 'failed')
    const successfulItems = Object.keys(newCart.purchases).filter(purchaseId => newCart.purchases[purchaseId] === 'completed')

    if (allItemsProcessed && successfulItems.length > 0) {
      console.log(`All items processed for cart ${newCart.id}. ${successfulItems.length} successful, ${Object.keys(newCart.purchases).length - successfulItems.length} failed.`)
      // Send receipt event for successful purchases only
      await putEvents({
        events: [
          {
            Source: 'purchase-carts-stream',
            DetailType: 'products-purchased',
            Detail: JSON.stringify({
              userId: newCart.user_id,
              cartId: newCart.id,
            })
          }
        ]
      })

      console.log(`Receipt sent for cart ${newCart.id}`)
    } else if (allItemsProcessed && successfulItems.length === 0) {
      console.log(`All items failed for cart ${newCart.id}, marking as completed without sending receipt`)
    }

  } catch (error) {
    console.error('Error processing cart stream record:', error)
    console.error('Record:', JSON.stringify(record, null, 2))
  }
}