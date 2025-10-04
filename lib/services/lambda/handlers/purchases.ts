import { unmarshall } from '@aws-sdk/util-dynamodb'
import { DynamoDBStreamEvent } from 'aws-lambda'
import { putEvents } from '../helpers/eventbridge/put-events'
import { adjustPurchaseAmount } from '../helpers/purchases/adjust-purchase-amount'
import { updatePurchasedProductAmount } from '../helpers/purchases/update-purchased-product-amount'

export interface Purchase {
  id: string
  user_id: string
  product_id: string
  product_group_id: string
  product_name: string
  is_one_time: boolean
  is_subscription: boolean
  is_metered_subscription: boolean
  purchased_at: string
  organization_id: string
  payment_method_id: string
  amount: number
  original_amount?: number
  currency: string
  cart_id?: string
  platform_fee_amount?: number
  original_platform_fee_amount?: number
  connected_account_id?: string
  destination_charge_id?: string
  transfer_id?: string
  tax_amount?: number
  original_tax_amount?: number
  base_amount?: number
  original_base_amount?: number
  seller_organization_id?: string
  applied_discount?: {
    type: 'promotion_code' | 'coupon'
    code?: string
    coupon?: {
      id: string
      amount_off: number
      percent_off: number
    }
  },
  status: 'completed' | 'pending' | 'failed'
}

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
      if (oldPurchase.amount !== newPurchase.amount) {
        await updatePurchasedProductAmount({
          purchaseId: newPurchase.id,
          amount: newPurchase.amount
        })
      }
    }
  }
}
