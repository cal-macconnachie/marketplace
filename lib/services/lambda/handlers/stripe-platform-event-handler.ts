import { EventBridgeEvent } from 'aws-lambda'
import Stripe from 'stripe'
import { getUserByStripeId } from '../helpers/users/get-user-by-stripe-id'
import { updatePurchaseStatus } from '../helpers/carts/update-purchase-status'
import { PurchasedProduct } from './products'
import { createPurchasedProductFromPurchase } from '../helpers/carts/create-purchased-product-from-purchase'
import { getStripeClient } from '../helpers/stripe/stripe-client'
import { create } from '../helpers/dynamo-helpers/create'
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
      const createPromises = purchasedProducts.map(product => create({
        tableName: process.env.PURCHASED_PRODUCTS_TABLE!,
        key: {
          organization_id: user?.organization_id,
          id: product.id
        },
        record: product
      }))
      await Promise.all(createPromises)
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
        const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id
        if (user && subscriptionId) {
          const purchasedProducts: PurchasedProduct[] = []
          const stripe = getStripeClient()
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          const cartId = subscription.metadata?.cart_id

          for (const item of invoice.lines.data) {
            if (item.subscription_item) {
              const subscriptionItem = await stripe.subscriptionItems.retrieve(item.subscription_item)
              console.log(JSON.stringify(subscriptionItem))
              const purchaseIds = JSON.parse(subscriptionItem.metadata?.purchase_ids ?? '[]')
              for (const purchaseId of purchaseIds) {
                await updatePurchaseStatus({
                  cartId,
                  userId: user.id,
                  purchaseId,
                  status: 'completed'
                }).catch(error => {
                  console.error(`Failed to update purchase status for purchase ${purchaseId}:`, error)
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
          const createPromises = purchasedProducts.map(product => create({
            tableName: process.env.PURCHASED_PRODUCTS_TABLE!,
            key: {
              organization_id: user?.organization_id,
              id: product.id
            },
            record: product
          }))
          await Promise.all(createPromises)
        }
      }

      console.log(`Invoice paid for customer ${customerId}, amount: ${invoice.amount_paid} ${invoice.currency}`)
      break
    }

    case 'invoice.payment_failed': {
      // Handle failed subscription payments
      const invoice = event.detail.data.object as Stripe.Invoice
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
      if (customerId) {
        const user = await getUserByStripeId(customerId)
        const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id
        if (user && subscriptionId) {
          const stripe = getStripeClient()
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          const cartId = subscription.metadata?.cart_id

          for (const item of invoice.lines.data) {
            if (item.subscription_item) {
              const subscriptionItem = await stripe.subscriptionItems.retrieve(item.subscription_item)
              const purchaseIds = JSON.parse(subscriptionItem.metadata?.purchase_ids ?? '[]')
              for (const purchaseId of purchaseIds) {
                await updatePurchaseStatus({
                  cartId,
                  userId: user.id,
                  purchaseId,
                  status: 'failed'
                }).catch(error => {
                  console.error(`Failed to update purchase status for purchase ${purchaseId}:`, error)
                })
              }
            }
          }
        }
      }

      console.log(`Invoice payment failed for customer ${customerId}, amount: ${invoice.amount_due} ${invoice.currency}`)
      break
    }
    default: {
      console.log(`Unhandled platform event type: ${type}`)
      break
    }
  }
}
