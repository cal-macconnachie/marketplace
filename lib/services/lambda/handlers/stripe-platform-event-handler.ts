import { EventBridgeEvent } from 'aws-lambda'
import Stripe from 'stripe'
import { getUserByStripeId } from '../helpers/users/get-user-by-stripe-id'
import { updatePurchaseStatus } from '../helpers/carts/update-purchase-status'
import { PurchasedProduct } from './products'
import { createPurchasedProductFromPurchase } from '../helpers/carts/create-purchased-product-from-purchase'
import { atomicUpdate } from '../helpers/dynamo-helpers/atomic-update'
import { getStripeClient } from '../helpers/stripe/stripe-client'
export interface Cart {
  user_id: string
  id: string
  purchases: { [purchaseId: string]: 'pending' | 'completed' | 'failed' }
  payment_method_id: string
  created_at: string
}

export const stripePlatformEventHandler = async (event: EventBridgeEvent<'Stripe Event', Stripe.Event>) => {
  const type = event.detail.type
  console.log(JSON.stringify(event.detail))

  switch (type) {
    case 'payment_intent.succeeded': {
      // one time payments
      const paymentIntent = event.detail.data.object as Stripe.PaymentIntent
      const customerId = typeof paymentIntent.customer === 'string' ? paymentIntent.customer : paymentIntent.customer?.id
      const user = await getUserByStripeId(customerId!)

      const purchaseIds = paymentIntent.metadata?.purchase_ids ? JSON.parse(paymentIntent.metadata.purchase_ids) : []
      const purchasedProducts: PurchasedProduct[] = []
      for (const purchaseId of purchaseIds) {
        if (user) {
          await updatePurchaseStatus({
            cartId: paymentIntent.metadata?.cart_id,
            userId: user.id,
            purchaseId,
            status: 'completed'
          })
          purchasedProducts.push(await createPurchasedProductFromPurchase({
            purchaseKey: {
              userId: user.id, purchaseId 
            } 
          }))
        }
      }
      // atomic update users org to add purchased products to purchased_products array
      await atomicUpdate({
        tableName: process.env.ORGANIZATIONS_TABLE!,
        key: { id: user?.organization_id },
        updateExpression: 'SET purchased_products = list_append(if_not_exists(purchased_products, :empty_list), :new_products)',
        expressionAttributeValues: {
          ':new_products': purchasedProducts,
          ':empty_list': []
        }
      })
      console.log(`PaymentIntent succeeded for customer ${customerId}, amount: ${paymentIntent.amount} ${paymentIntent.currency}`)
      break
    }
    
    case 'payment_intent.payment_failed': {
      const paymentIntent = event.detail.data.object as Stripe.PaymentIntent
      const customerId = typeof paymentIntent.customer === 'string' ? paymentIntent.customer : paymentIntent.customer?.id
      const user = await getUserByStripeId(customerId!)

      const purchaseIds = paymentIntent.metadata?.purchase_ids ? JSON.parse(paymentIntent.metadata.purchase_ids) : []
      for (const purchaseId of purchaseIds) {
        if (user) {
          await updatePurchaseStatus({
            cartId: paymentIntent.metadata?.cart_id,
            userId: user.id,
            purchaseId,
            status: 'failed'
          })
        }
      }

      console.log(`PaymentIntent failed for customer ${customerId}, amount: ${paymentIntent.amount} ${paymentIntent.currency}`)
      break
    }
    
    case 'transfer.created': {
      const transfer = event.detail.data.object as Stripe.Transfer
      
      console.log(`Transfer created: ${transfer.id} to destination ${transfer.destination}`)
      
      // TODO: Update purchase records with transfer_id for tracking
      // This helps with reconciliation and refund handling
      break
    }
    
    case 'application_fee.created': {
      const applicationFee = event.detail.data.object as Stripe.ApplicationFee
      
      console.log(`Platform fee collected: ${applicationFee.amount} ${applicationFee.currency} for charge ${applicationFee.charge}`)
      
      // TODO: Record platform revenue and fee collection
      // This is important for financial reporting and analytics
      break
    }
    
    case 'charge.dispute.created': {
      const dispute = event.detail.data.object as Stripe.Dispute
      
      console.log(`Chargeback created for charge ${dispute.charge}: ${dispute.reason}`)
      
      // TODO: Handle chargebacks (platform responsibility with destination charges)
      // - Notify relevant parties
      // - Gather evidence if needed
      // - Update records for dispute tracking
      break
    }
    
    case 'invoice.paid': {
      // Handle subscription payments that are destination charges
      const invoice = event.detail.data.object as Stripe.Invoice
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
      if (customerId) {
        const user = await getUserByStripeId(customerId)
        if (user && invoice.parent?.type === 'subscription_details') {
          const purchasedProducts: PurchasedProduct[] = []
          const stripe = getStripeClient()
          const invoiceItems = invoice.lines.data
          const subscriptionMetadata = invoice.parent.subscription_details?.metadata
          const cartId = subscriptionMetadata?.cart_id
          for (const item of invoiceItems) {
            if (item.parent?.subscription_item_details?.subscription_item) {
              const subscriptionItem = await stripe.subscriptionItems.retrieve(item.parent?.subscription_item_details?.subscription_item)
              const purchaseIds = JSON.parse(subscriptionItem.metadata?.purchase_ids ?? '[]')
              for (const purchaseId of purchaseIds) {
                await updatePurchaseStatus({
                  cartId,
                  userId: user.id,
                  purchaseId,
                  status: 'completed'
                })

                purchasedProducts.push(await createPurchasedProductFromPurchase({
                  purchaseKey: {
                    userId: user.id, purchaseId 
                  },
                  subscriptionItem
                }))
              }
            }
          }
          await atomicUpdate({
            tableName: process.env.ORGANIZATIONS_TABLE!,
            key: { id: user?.organization_id },
            updateExpression: 'SET purchased_products = list_append(if_not_exists(purchased_products, :empty_list), :new_products)',
            expressionAttributeValues: {
              ':new_products': purchasedProducts,
              ':empty_list': []
            }
          })
        }
      }

      console.log(`Invoice paid for customer ${customerId}, amount: ${invoice.amount_paid} ${invoice.currency}`)
      break
    }
    default: {
      console.log(`Unhandled platform event type: ${type}`)
      break
    }
  }
}
