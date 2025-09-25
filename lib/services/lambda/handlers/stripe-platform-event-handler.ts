import { EventBridgeEvent } from 'aws-lambda'
import Stripe from 'stripe'
import { get } from '../helpers/dynamo-helpers/get'
import { update } from '../helpers/dynamo-helpers/update'
import { atomicUpdate } from '../helpers/dynamo-helpers/atomic-update'
import { User } from './users'
import { getStripeClient } from '../helpers/stripe/stripe-client'
import { queryAll } from '../helpers/dynamo-helpers/query'
import { createPurchaseCart } from '../helpers/create-purchase-cart'
import { Organization } from './organizations'

interface CartItem {
  product_id: string
  group_id: string
  processed?: boolean // undefined = not processed, true = success, false = failed
}

export interface Cart {
  user_id: string
  id: string
  items: CartItem[]
  purchases: string[]
  payment_method_id: string
  created_at: string
  status: 'pending' | 'completed'
}

// Atomically mark a cart item as processed using DynamoDB update expressions
const markCartItemProcessed = async (cartId: string, userId: string, productId: string, success: boolean = true) => {
  // Get cart to find item index (we need this for the atomic update)
  const cart = await get<Cart>({
    tableName: process.env.PURCHASE_CARTS_TABLE!,
    key: {
      user_id: userId,
      id: cartId
    }
  })

  if (!cart) {
    throw new Error(`Cart not found: ${cartId}`)
  }

  // Find the index of the item to update
  const itemIndex = cart.items.findIndex(item => item.product_id === productId)
  if (itemIndex === -1) {
    throw new Error(`Product ${productId} not found in cart ${cartId}`)
  }

  // Use atomic update expression to set the processed flag for this specific item
  await atomicUpdate({
    tableName: process.env.PURCHASE_CARTS_TABLE!,
    key: {
      user_id: userId,
      id: cartId
    },
    updateExpression: `SET #items[${itemIndex}].#processed = :processed`,
    expressionAttributeNames: {
      '#items': 'items',
      '#processed': 'processed'
    },
    expressionAttributeValues: {
      ':processed': success
    }
  })
}

export const stripePlatformEventHandler = async (event: EventBridgeEvent<'Stripe Event', Stripe.Event>) => {
  const type = event.detail.type
  
  switch (type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.detail.data.object as Stripe.PaymentIntent
      const customerId = typeof paymentIntent.customer === 'string' ? paymentIntent.customer : paymentIntent.customer?.id
      
      if (!customerId) {
        console.error('No customer ID found in payment intent:', paymentIntent.id)
        return
      }

      // Find user by stripe customer ID
      const users = await queryAll<User>({
        tableName: process.env.USERS_TABLE!,
        indexName: 'stripe_id-index',
        keyConditionExpression: 'stripe_id = :stripeId',
        expressionAttributeValues: {
          ':stripeId': customerId
        }
      })
      const user = users[0]

      if (!user) {
        console.error('No user found for stripeUserId:', customerId)
        return
      }

      if (!user.organization_id) {
        console.error('User does not have an organization_id:', user.id)
        return
      }

      const organization = await get<Organization>({
        tableName: process.env.ORGANIZATIONS_TABLE!,
        key: { id: user.organization_id }
      })

      if (!organization) {
        console.error('Organization not found for user:', user.id)
        return
      }

      // Handle destination charge completion with cart-based receipt flow
      if (paymentIntent.transfer_data?.destination) {
        const cartId = paymentIntent.metadata?.cart_id

        // Create purchase records from payment intent metadata
        if (paymentIntent.metadata?.product_ids && cartId) {
          const productIds = JSON.parse(paymentIntent.metadata.product_ids)

          for (const productId of productIds) {
            try {
              // Atomically mark this product as processed in the cart
              // The DynamoDB stream handler will send the receipt when all items are processed
              try {
                await markCartItemProcessed(cartId, user.id, productId, true)
              } catch (error) {
                console.error(`Failed to mark cart item as processed for product ${productId}:`, error)
              }
            } catch (error) {
              console.error(`Failed to create purchase record for product ${productId}:`, error)
              // Mark this item as failed in the cart
              if (cartId) {
                try {
                  await markCartItemProcessed(cartId, user.id, productId, false)
                } catch (markError) {
                  console.error(`Failed to mark cart item as failed for product ${productId}:`, markError)
                }
              }
            }
          }
        }
      }
      break
    }
    
    case 'payment_intent.payment_failed': {
      const paymentIntent = event.detail.data.object as Stripe.PaymentIntent
      const customerId = typeof paymentIntent.customer === 'string' ? paymentIntent.customer : paymentIntent.customer?.id
      
      if (!customerId) {
        console.error('No customer ID found in failed payment intent:', paymentIntent.id)
        return
      }

      // Log payment failure for platform destination charges
      if (paymentIntent.transfer_data?.destination) {
        const connectedAccountId = paymentIntent.transfer_data.destination
        console.log(`Destination charge failed for ${paymentIntent.id} to connected account ${connectedAccountId}`)
        
        // TODO: Implement failure handling logic
        // - Notify user of payment failure
        // - Retry payment if applicable
        // - Update organization status if needed
      }
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
      
      if (!customerId) {
        console.error('No customer ID found in invoice:', invoice.id)
        return
      }

      const users = await queryAll<User>({
        tableName: process.env.USERS_TABLE!,
        indexName: 'stripe_id-index',
        keyConditionExpression: 'stripe_id = :stripeId',
        expressionAttributeValues: {
          ':stripeId': customerId
        }
      })
      const user = users[0]
      
      if (!user) {
        console.error('No user found for stripeUserId:', customerId)
        return
      }

      if (!user.organization_id) {
        console.error('User does not have an organization_id:', user.id)
        return
      }

      const organization = await get<Organization>({
        tableName: process.env.ORGANIZATIONS_TABLE!,
        key: { id: user.organization_id }
      })

      if (!organization) {
        console.error('Organization not found for user:', user.id)
        return
      }

      // Handle subscription invoices (renewals, creation, and proration updates)
      const billingReason = invoice.billing_reason
      const isSubInvoice =
        (billingReason === 'subscription_cycle' ||
         billingReason === 'subscription_create') &&
        invoice.lines?.data?.length > 0

      if (isSubInvoice) {
        const subscriptionLineItems = invoice.lines.data.filter(item =>
          Boolean(item.period && item.pricing?.price_details?.price && item.pricing?.price_details?.product)
        )
        
        if (subscriptionLineItems.length > 0) {
          const productPeriods = new Map<string, number>()
          
          for (const lineItem of subscriptionLineItems) {
            const periodEnd = lineItem.period?.end
            const productId = lineItem.pricing?.price_details?.product
            if (periodEnd && productId) {
              const currentPeriodEnd = productPeriods.get(productId) || 0
              if (periodEnd > currentPeriodEnd) {
                productPeriods.set(productId, periodEnd)
              }
            }
          }
          
          // Update organization's purchased products only for full cycle/creation
          if (organization.purchased_products && productPeriods.size > 0 && (billingReason === 'subscription_cycle' || billingReason === 'subscription_create')) {
            const updatedPurchasedProducts = organization.purchased_products.map(product => {
              const newPeriodEnd = productPeriods.get(product.id)
              if (newPeriodEnd) {
                return {
                  ...product,
                  in_good_standing_until: newPeriodEnd
                }
              }
              return product
            })
            
            await update<Organization>({
              tableName: process.env.ORGANIZATIONS_TABLE!,
              key: { id: organization.id },
              updates: { purchased_products: updatedPurchasedProducts }
            })
          }

          // Determine connected account id and cart id for direct charge
          const stripe = getStripeClient()
          let connectedAccountId: string | undefined = invoice.metadata ? (invoice.metadata as Record<string, string>)['connected_account_id'] : undefined
          let cartId: string | undefined = invoice.metadata ? (invoice.metadata as Record<string, string>)['cart_id'] : undefined
          const subscriptionId = typeof invoice.parent?.subscription_details?.subscription === 'string' ? invoice.parent.subscription_details.subscription : invoice.parent?.subscription_details?.subscription?.id
          if ((!connectedAccountId || !cartId) && subscriptionId) {
            try {
              const sub = await stripe.subscriptions.retrieve(subscriptionId)
              const metadata = sub.metadata as Record<string, string> | undefined
              if (metadata) {
                if (!connectedAccountId) connectedAccountId = metadata['connected_account_id']
                if (!cartId) cartId = metadata['cart_id']
              }
            } catch (e) {
              console.warn('Unable to retrieve subscription for connected account id lookup:', e)
            }
          }

          if (cartId == null) {
            const newCart = await createPurchaseCart({
              userId: user.id,
              items: [],
              purchaseIds: [],
              paymentMethodId: typeof invoice.default_payment_method === 'string' ? invoice.default_payment_method : invoice.default_payment_method?.id || ''
            })
            cartId = newCart.id
          }

          // Compute exact platform fee from the charge via PaymentIntent
          let chargeId: string | undefined
          // Look for payment_intent in the payments array
          const invoicePayment = invoice.payments?.data?.[0]
          if (invoicePayment?.payment?.payment_intent) {
            const paymentIntentId = typeof invoicePayment.payment.payment_intent === 'string' ? invoicePayment.payment.payment_intent : invoicePayment.payment.payment_intent.id
            try {
              const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
              chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id
            } catch (e) {
              console.warn('Unable to retrieve payment intent for invoice', invoice.id, e)
            }
          }
          let totalFee = 0
          if (chargeId) {
            try {
              const fees = await stripe.applicationFees.list({
                charge: chargeId, limit: 100 
              })
              totalFee = fees.data.reduce((sum, f) => sum + (f.amount || 0), 0)
            } catch (e) {
              console.warn('Unable to retrieve application fee for charge', chargeId, e)
            }
          }

          // Sum amounts across relevant line items for proportional allocation
          const totalLinesAmount = subscriptionLineItems.reduce((s, li) => s + (li.amount || 0), 0)
          let allocated = 0

          // Create purchase records for these invoice lines
          for (let i = 0; i < subscriptionLineItems.length; i++) {
            const lineItem = subscriptionLineItems[i]
            const productId = lineItem.pricing?.price_details?.product
            if (!productId) continue
            try {
              // Subscription products always exist in the platform account, not connected accounts

              const amount = lineItem.amount || 0
              let feeShare = 0
              if (totalFee > 0 && totalLinesAmount > 0) {
                feeShare = i === subscriptionLineItems.length - 1
                  ? totalFee - allocated
                  : Math.round((amount / totalLinesAmount) * totalFee)
                if (feeShare < 0) feeShare = 0
                allocated += feeShare
              }

              // Handle cart-based processing for subscriptions
              if (cartId) {
                // The DynamoDB stream handler will send the receipt when all items are processed
                try {
                  await markCartItemProcessed(cartId, user.id, productId, true)
                } catch (error) {
                  console.error(`Failed to mark cart item as processed for subscription product ${productId}:`, error)
                }
              }
            } catch (error) {
              console.error(`Failed to create purchase record for subscription product ${productId}:`, error)
              // Mark this item as failed in the cart
              if (cartId) {
                try {
                  await markCartItemProcessed(cartId, user.id, productId, false)
                } catch (markError) {
                  console.error(`Failed to mark cart item as failed for subscription product ${productId}:`, markError)
                }
              }
            }
          }
        }
      }
      break
    }
    
    default: {
      console.log(`Unhandled platform event type: ${type}`)
      break
    }
  }
}
