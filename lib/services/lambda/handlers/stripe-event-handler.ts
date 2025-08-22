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

export const stripeEventHandler = async (event: EventBridgeEvent<'Stripe Event', Stripe.Event>) => {
  const type = event.detail.type
  // if subscription invoice payment succeeded we should update the user record `inGoodStandingUntil` field
  switch (type) {
    case 'invoice.paid': {
      const invoice = event.detail.data.object
      const stripeUserId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
      if (!stripeUserId) {
        console.error('No customer ID found in invoice:', invoice)
        return
      }
      const user = await get<User>({
        tableName: process.env.USERS_TABLE!,
        key: { stripeUserId }
      })
      if (!user) {
        console.error('No user found for stripeUserId:', stripeUserId)
        return
      }
      if (user.organization_id == null) {
        console.error('User does not have an organization_id:', user.id)
        return
      }
      const organization = await get<Organization>({
        tableName: process.env.ORGANIZATIONS_TABLE!,
        key: { id: user.organization_id }
      })
      if (organization == null) {
        console.error('Organization not found for user:', user.id)
        return
      }

      // Check if this is a subscription-generated invoice using billing_reason
      if (invoice.billing_reason === 'subscription_cycle' && invoice.lines?.data?.length > 0) {
        // Process each line item individually to update specific product periods
        const subscriptionLineItems = invoice.lines.data.filter(item => 
          item.period && 
          item.pricing?.price_details?.price && 
          item.pricing?.price_details?.product
        )
        
        if (subscriptionLineItems.length > 0) {
          // Create a map of product periods for updating purchased_products
          const productPeriods = new Map<string, number>()
          
          // Process each line item
          for (const lineItem of subscriptionLineItems) {
            const periodEnd = lineItem.period?.end
            const productId = lineItem.pricing?.price_details?.product
            
            if (periodEnd && productId) {
              // Keep track of the latest period end for each product
              const currentPeriodEnd = productPeriods.get(productId) || 0
              if (periodEnd > currentPeriodEnd) {
                productPeriods.set(productId, periodEnd)
              }
            }
          }
          
          // Update the organization's purchased products with new in_good_standing_until dates
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
            
            // Update the organization with the new purchased products
            await update<Organization>({
              tableName: process.env.ORGANIZATIONS_TABLE!,
              key: { id: organization.id },
              updates: { purchased_products: updatedPurchasedProducts }
            })
            
            // Create purchase records for each subscription renewal
            const stripe = getStripeClient()
            for (const lineItem of subscriptionLineItems) {
              const productId = lineItem.pricing?.price_details?.product
              if (productId) {
                try {
                  const stripeProduct = await stripe.products.retrieve(productId)
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
                    amount: amount
                  }
                  
                  await addPurchase(purchase)
                  console.log(`Created purchase record for product ${productId} renewal for organization ${organization.id}`)
                } catch (error) {
                  console.error(`Failed to create purchase record for product ${productId}:`, error)
                }
              }
            }
            
            // Log the updates
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
    case 'invoice.payment_failed': {
      const invoice = event.detail.data.object
      const stripeUserId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
      
      // TODO: In the future, trigger email to user about payment failure
      // and instruct them to update their payment method to continue receiving access

      console.log(`Payment failure logged for ${stripeUserId} - user retains access until subscription expires`)
      break
    }
    default: {
      console.log(`Unhandled event type: ${type}`)
      break
    }
  }
}