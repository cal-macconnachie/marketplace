import {
  purchaseCartsTableName,
  purchasesTableName, usersTableName
} from '@marketplace/constants'
import {
  Purchase, User
} from '@marketplace/types'
import { EventBridgeEvent } from 'aws-lambda'
import { updatePurchaseStatus } from '../../helpers/carts/update-purchase-status'
import { atomicUpdate } from '../../helpers/dynamo-helpers/atomic-update'
import { batchGet } from '../../helpers/dynamo-helpers/batch-get'
import { get } from '../../helpers/dynamo-helpers/get'
import { createDestinationCharge } from '../../helpers/stripe/create-destination-charge'
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
      tableName: purchasesTableName!,
      keys: purchase_keys.map(({
        user_id,
        id
      }) => ({
        user_id,
        id
      }))
    })
    const user = await get<User>({
      tableName: usersTableName!,
      key: {
        id: purchases[0].user_id
      }
    })
    if (!user) {
      throw new Error(`User not found`)
    }

    // organize payments into one-time or recurring and group by currency/ connected_account_id
    const oneTimePurchases = purchases.filter(p => p.type === 'one_time')
    const oneTimeGroups = oneTimePurchases.reduce((acc: { [key:string]: Purchase[]}, curr) => {
      const key = `${curr.currency}:${curr.connected_account_id}`
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(curr)
      return acc
    }, {})
    const recurringPurchases = purchases.filter(p => p.type === 'subscription')
    const recurringGroups = recurringPurchases.reduce((acc: { [key:string]: Purchase[]}, curr) => {
      const key = `${curr.currency}:${curr.connected_account_id}`
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(curr)
      return acc
    }, {})
    const meteredPurchases = purchases.filter(p => p.type === 'metered_subscription')
    const meteredGroups = meteredPurchases.reduce((acc: { [key:string]: Purchase[]}, curr) => {
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
        const paymentIntent = await createDestinationCharge({
          amount: group.reduce((sum, p) => sum + p.amount, 0),
          currency: group[0].currency,
          paymentMethodId: group[0].payment_method_id,
          user,
          destinationAccountId,
          cartId: group[0].cart_id,
          purchaseIds: group.map(p => p.id)
        })
        // if paymentIntent requires next step add next step to purchase cart
        if (paymentIntent && paymentIntent.status === 'requires_action') {
          console.log(`Payment intent ${paymentIntent.id} requires action, updating cart ${group[0].cart_id} with next step`)
          // add next step to cart
          // we only need to do this once per cart, so only do it for the first purchase in the group
          if (group[0].cart_id) {
            // update cart with next step
            // we can assume all purchases in the group have the same cart_id
            const nextStepItem = {
              type: 'payment_action_required',
              payment_intent_client_secret: paymentIntent.client_secret!,
              payment_intent_id: paymentIntent.id
            }

            await atomicUpdate({
              tableName: purchaseCartsTableName,
              key: {
                user_id: group[0].user_id,
                id: group[0].cart_id
              },
              updateExpression: 'SET next_steps = if_not_exists(next_steps, :empty_list), next_steps = list_append(next_steps, :new_step)',
              expressionAttributeValues: {
                ':empty_list': [],
                ':new_step': [nextStepItem]
              }
            })
          }
        }
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

    for (const [
      , group
    ] of Object.entries(meteredGroups)) {
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
        console.error('Error handling metered subscription:', e)
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