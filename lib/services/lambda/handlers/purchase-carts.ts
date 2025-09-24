import { DynamoDBStreamEvent, DynamoDBRecord } from 'aws-lambda'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { putEvents } from '../helpers/eventbridge/put-events'
import { query } from '../helpers/dynamo-helpers/query'
import { update } from '../helpers/dynamo-helpers/update'
import { Purchase } from './purchases'

interface CartItem {
  product_id: string
  group_id: string
  processed: boolean
}

interface Cart {
  user_id: string
  id: string
  items: CartItem[]
  created_at: string
  status: 'pending' | 'completed'
}

// Helper function to get all purchases for a cart
const getAllPurchasesForCart = async (cartId: string): Promise<Purchase[]> => {
  try {
    const result = await query<Purchase>({
      tableName: process.env.PURCHASES_TABLE!,
      indexName: 'cart_id-index',
      keyConditionExpression: 'cart_id = :cart_id',
      expressionAttributeValues: {
        ':cart_id': cartId
      }
    })

    return result.items || []
  } catch (error) {
    console.error(`Failed to get purchases for cart ${cartId}:`, error)
    return []
  }
}

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
    const newCart = unmarshall(record.dynamodb.NewImage) as Cart
    const oldCart = unmarshall(record.dynamodb.OldImage) as Cart

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

      // Get all purchases for this cart (only successful ones will exist)
      const allPurchases = await getAllPurchasesForCart(newCart.id)

      if (allPurchases.length > 0) {
        // Send receipt event for successful purchases only
        await putEvents({
          events: [
            {
              Source: 'purchase-carts-stream',
              DetailType: 'products-purchased',
              Detail: JSON.stringify({
                userId: newCart.user_id,
                paymentMethodId: allPurchases[0]?.payment_method_id || '',
                purchases: allPurchases.map(p => ({
                  user_id: p.user_id,
                  id: p.id
                })),
                products: successfulItems.map((item: CartItem) => ({
                  group_id: item.group_id,
                  id: item.product_id,
                  quantity: 1
                }))
              })
            }
          ]
        })

        console.log(`Receipt sent for cart ${newCart.id} with ${allPurchases.length} purchases`)

        // Mark cart as completed
        await update({
          tableName: process.env.PURCHASE_CARTS_TABLE!,
          key: {
            user_id: newCart.user_id,
            id: newCart.id
          },
          updates: { status: 'completed' }
        })
      } else {
        console.log(`No purchases found for cart ${newCart.id}, skipping receipt`)
      }
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