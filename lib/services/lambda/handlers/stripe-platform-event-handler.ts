import { EventBridgeEvent } from 'aws-lambda'
import Stripe from 'stripe'
import { get } from '../helpers/dynamo-helpers/get'
import { update } from '../helpers/dynamo-helpers/update'
import { User } from './users'
import { Organization } from './organizations'
import { addPurchase } from '../helpers/add-purchase'
import { Purchase } from './purchases'
import { v4 } from 'uuid'
import { getStripeClient } from '../helpers/stripe/stripe-client'

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
      const user = await get<User>({
        tableName: process.env.USERS_TABLE!,
        key: { stripeUserId: customerId }
      })
      
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

      // Handle destination charge completion
      if (paymentIntent.transfer_data?.destination) {
        const connectedAccountId = paymentIntent.transfer_data.destination
        console.log(`Destination charge succeeded for ${paymentIntent.id} to connected account ${connectedAccountId}`)
        
        // Create purchase records from payment intent metadata or line items
        if (paymentIntent.metadata?.product_ids) {
          const productIds = JSON.parse(paymentIntent.metadata.product_ids)
          const stripe = getStripeClient()
          
          for (const productId of productIds) {
            try {
              // Retrieve product from connected account
              const stripeProduct = await stripe.products.retrieve(productId, {
                stripeAccount: typeof connectedAccountId === 'string' ? connectedAccountId : connectedAccountId.id
              })
              
              const purchase: Purchase = {
                id: v4(),
                user_id: user.id,
                product_id: productId,
                product_name: stripeProduct.name,
                is_one_time: true,
                is_subscription: false,
                purchased_at: new Date().toISOString(),
                organization_id: organization.id,
                payment_method_id: typeof paymentIntent.payment_method === 'string' ? paymentIntent.payment_method : paymentIntent.payment_method?.id || '',
                amount: paymentIntent.amount,
                currency: paymentIntent.currency
              }
              
              await addPurchase(purchase)
              console.log(`Created purchase record for destination charge ${paymentIntent.id}, product ${productId}`)
            } catch (error) {
              console.error(`Failed to create purchase record for product ${productId}:`, error)
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

      const user = await get<User>({
        tableName: process.env.USERS_TABLE!,
        key: { stripeUserId: customerId }
      })
      
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

      // Check if this is a subscription-generated invoice for destination charges
      if (invoice.billing_reason === 'subscription_cycle' && invoice.lines?.data?.length > 0) {
        const subscriptionLineItems = invoice.lines.data.filter(item => 
          item.period && 
          item.pricing?.price_details?.price && 
          item.pricing?.price_details?.product
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
          
          // Update organization's purchased products
          if (organization.purchased_products && productPeriods.size > 0) {
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
            
            // Create purchase records for subscription renewals
            const stripe = getStripeClient()
            for (const lineItem of subscriptionLineItems) {
              const productId = lineItem.pricing?.price_details?.product
              if (productId) {
                try {
                  // For destination charges, we need to determine which connected account
                  // This could be stored in invoice metadata or subscription metadata
                  const connectedAccountId = invoice.metadata?.connected_account_id
                  
                  const stripeProduct = connectedAccountId 
                    ? await stripe.products.retrieve(productId, { stripeAccount: connectedAccountId })
                    : await stripe.products.retrieve(productId)
                  
                  const amount = lineItem.amount || 0
                  
                  const purchase: Purchase = {
                    id: v4(),
                    user_id: user.id,
                    product_id: productId,
                    product_name: stripeProduct.name,
                    is_one_time: false,
                    is_subscription: true,
                    purchased_at: new Date().toISOString(),
                    organization_id: organization.id,
                    payment_method_id: typeof invoice.default_payment_method === 'string' ? invoice.default_payment_method : invoice.default_payment_method?.id || '',
                    amount: amount,
                    currency: lineItem.currency
                  }
                  
                  await addPurchase(purchase)
                  console.log(`Created purchase record for platform subscription renewal ${productId} for organization ${organization.id}`)
                } catch (error) {
                  console.error(`Failed to create purchase record for subscription product ${productId}:`, error)
                }
              }
            }
            
            for (const [
              productId, 
              periodEnd
            ] of productPeriods.entries()) {
              console.log(`Updated product ${productId} for organization ${organization.id} in_good_standing_until to ${new Date(periodEnd * 1000).toISOString()}`)
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