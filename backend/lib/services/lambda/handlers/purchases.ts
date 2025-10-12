import { unmarshall } from '@aws-sdk/util-dynamodb'
import { Purchase } from '@marketplace/types'
import { DynamoDBStreamEvent } from 'aws-lambda'
import { putEvents } from '../helpers/eventbridge/put-events'
import { adjustPurchaseAmount } from '../helpers/purchases/adjust-purchase-amount'
import { updatePurchasedProductAmount } from '../helpers/purchases/update-purchased-product-amount'

export const purchases =  async (event: DynamoDBStreamEvent) => {
  for (const record of event.Records) {
    if (record.eventName === 'INSERT' && record.dynamodb?.NewImage) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newPurchase = unmarshall(record.dynamodb.NewImage as any) as Purchase
      // put purchase created event to event bus
      await putEvents({
        events: [
          {
            Source: 'purchases',
            DetailType: 'purchase-created',
            Detail: JSON.stringify({
              user_id: newPurchase.user_id,
              id: newPurchase.id
            })
          }
        ]
      })
    }

    if (record.eventName === 'MODIFY' && record.dynamodb?.NewImage && record.dynamodb?.OldImage) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const oldPurchase = unmarshall(record.dynamodb.OldImage as any) as Purchase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newPurchase = unmarshall(record.dynamodb.NewImage as any) as Purchase

      // If status changed to failed, adjust amount to zero
      if (oldPurchase.status !== 'failed' && newPurchase.status === 'failed') {
        if (newPurchase.amount !== 0) {
          console.log(`Adjusting failed purchase ${newPurchase.id} amount to zero`)
          await adjustPurchaseAmount({
            purchase: newPurchase,
            correctAmount: 0
          })
        }
      }
      // if amount changed and status is pending update the purchasedProduct
      if (newPurchase.base_amount != null && oldPurchase.base_amount !== newPurchase.base_amount) {
        await updatePurchasedProductAmount({
          purchaseId: newPurchase.id,
          amount: newPurchase.base_amount
        })
      }
    }
  }
}
