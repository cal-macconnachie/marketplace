import { EventBridgeEvent } from 'aws-lambda'
import { Purchase } from '../purchases'
import { batchGet } from '../../helpers/dynamo-helpers/batch-get'
import { createDestinationCharge } from '../../helpers/stripe/create-destination-charge'
import { get } from '../../helpers/dynamo-helpers/get'
import { User } from '../users'
import { updatePurchaseStatus } from '../../helpers/carts/update-purchase-status'
import { handleSubscription } from '../../helpers/stripe/handle-subscription'
interface PurchaseKey {
  user_id: string
  id: string
}
interface PurchaseEventDetail {
  purchase_keys: PurchaseKey[]
}
export const handlePurchase = async (event: EventBridgeEvent<'PurchaseKeyEvent', PurchaseEventDetail>) => {
  // Your implementation here
  try {
    const {
      purchase_keys
    } = event.detail
    const purchases = await batchGet<Purchase>({
      tableName: process.env.PURCHASES_TABLE!,
      keys: purchase_keys.map(({
        user_id,
        id
      }) => ({
        user_id,
        id
      }))
    })
    const user = await get<User>({
      tableName: process.env.USERS_TABLE!,
      key: {
        id: purchases[0].user_id
      }
    })
    if (!user) {
      throw new Error(`User not found`)
    }

    // organize payments into one-time or recurring and group by currency/ connected_account_id
    const oneTimePurchases = purchases.filter(p => p.is_one_time)
    console.log('One-time purchases:', oneTimePurchases)
    const oneTimeGroups = oneTimePurchases.reduce((acc: { [key:string]: Purchase[]}, curr) => {
      const key = `${curr.currency}:${curr.connected_account_id}`
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(curr)
      return acc
    }, {})
    const recurringPurchases = purchases.filter(p => p.is_subscription)
    console.log('Recurring purchases:', recurringPurchases)
    const recurringGroups = recurringPurchases.reduce((acc: { [key:string]: Purchase[]}, curr) => {
      const key = `${curr.currency}:${curr.connected_account_id}`
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(curr)
      return acc
    }, {})

    // each one time group creates a single destination charge
    // Status updates happen via payment_intent.succeeded or payment_intent.payment_failed webhooks
    for (const [
      ,
      group
    ] of Object.entries(oneTimeGroups)) {
      if (group.length === 0) {
        continue
      }
      const destinationAccountId = group[0].connected_account_id
      try {
        if (!destinationAccountId) {
          throw new Error(`Destination account ID not found`)
        }
        await createDestinationCharge({
          amount: group.reduce((sum, p) => sum + p.amount, 0),
          currency: group[0].currency,
          paymentMethodId: group[0].payment_method_id,
          user,
          destinationAccountId,
          cartId: group[0].cart_id,
          purchaseIds: group.map(p => p.id)
        })
        // Payment intent status will be updated via webhook (payment_intent.succeeded or payment_intent.payment_failed)
      } catch (e){
        console.error('Error creating destination charge:', e)
        // Mark purchases as failed if we couldn't even create the payment intent
        for (const purchase of group) {
          try {
            await updatePurchaseStatus({
              cartId: purchase.cart_id,
              userId: purchase.user_id,
              purchaseId: purchase.id,
              status: 'failed'
            })
          } catch (error) {
            console.error(`Failed to update purchase status for purchase ${purchase.id}:`, error)
          // fallthrough
          }
        }
      }
    }
    // each group of recurring products creates creates or updates one subscription on stripe/ the users organization,
    for (const [
      , group
    ] of Object.entries(recurringGroups)) {
      if (group.length === 0) {
        continue
      }
      const destinationAccountId = group[0].connected_account_id
      try {
        if (!destinationAccountId) {
          throw new Error(`Destination account ID not found`)
        }
        await handleSubscription({
          purchases: group,
          user
        })
      } catch (e) {
        console.error('Error handling subscription:', e)
        for (const purchase of group) {
          try {
            await updatePurchaseStatus({
              cartId: purchase.cart_id,
              userId: purchase.user_id,
              purchaseId: purchase.id,
              status: 'failed'
            })
          } catch (error) {
            console.error(`Failed to update purchase status for purchase ${purchase.id}:`, error)
          // fallthrough
          }
        }
      }
    }
  } catch (error) {
    console.error('Error handling purchase event:', error)
  }
}