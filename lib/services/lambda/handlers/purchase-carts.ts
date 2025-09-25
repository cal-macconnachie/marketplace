import {
  DynamoDBStreamEvent, DynamoDBRecord 
} from 'aws-lambda'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { putEvents } from '../helpers/eventbridge/put-events'
import { update } from '../helpers/dynamo-helpers/update'
import { Cart } from './stripe-platform-event-handler'

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

    // Check if any items were marked as processed (true or false)
    const hasNewProcessedItems = newCart.items.some((newItem, index) => {
      const oldItem = oldCart.items[index]
      return oldItem && !oldItem.processed && newItem.processed !== undefined
    })

    if (!hasNewProcessedItems) {
      return
    }

    // Check if all items are now processed (either success=true or fail=false)
    const allItemsProcessed = newCart.items.every(item => item.processed !== undefined)
    const successfulItems = newCart.items.filter(item => item.processed === true)

    if (allItemsProcessed && successfulItems.length > 0) {
      console.log(`All items processed for cart ${newCart.id}. ${successfulItems.length} successful, ${newCart.items.length - successfulItems.length} failed.`)
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

      // Mark cart as completed
      await update({
        tableName: process.env.PURCHASE_CARTS_TABLE!,
        key: {
          user_id: newCart.user_id,
          id: newCart.id
        },
        updates: { status: 'completed' }
      })
    } else if (allItemsProcessed && successfulItems.length === 0) {
      console.log(`All items failed for cart ${newCart.id}, marking as completed without sending receipt`)

      // Mark cart as completed (all items failed)
      await update({
        tableName: process.env.PURCHASE_CARTS_TABLE!,
        key: {
          user_id: newCart.user_id,
          id: newCart.id
        },
        updates: { status: 'completed' }
      })
    }

  } catch (error) {
    console.error('Error processing cart stream record:', error)
    console.error('Record:', JSON.stringify(record, null, 2))
  }
}