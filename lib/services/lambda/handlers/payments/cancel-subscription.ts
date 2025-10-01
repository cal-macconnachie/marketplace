import { APIGatewayProxyEvent } from 'aws-lambda'
import { get } from '../../helpers/dynamo-helpers/get'
import { User } from '../users'
import { Organization } from '../organizations'
import { getStripeClient } from '../../helpers/stripe/stripe-client'
import { update } from '../../helpers/dynamo-helpers/update'
import { PurchasedProduct } from '../products'
import { query } from '../../helpers/dynamo-helpers/query'

export async function cancelSubscription(event: APIGatewayProxyEvent) {
  try {
    const { body } = event
    const {
      user_id: userId,
      purchased_product,
    } : {
      user_id: string,
      purchased_product?: PurchasedProduct
    } = JSON.parse(body ?? '{}')
    const subscriptionId = purchased_product?.subscription_id
    if (!userId || !subscriptionId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing user_id or subscription_id' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true
        }
      }
    }
    // ensure this user is an organization admin for the subscription
    const user = await get<User>({
      tableName: process.env.USERS_TABLE!,
      key: { id: userId }
    })
    if (!user || !user.is_organization_admin) {
      throw new Error(`User is not an organization admin: ${userId}`)
    }
    const organization = await get<Organization>({
      tableName: process.env.ORGANIZATIONS_TABLE!,
      key: { id: user.organization_id }
    })
    if (!organization) {
      throw new Error(`Organization not found: ${user.organization_id}`)
    }
    // Check if subscription exists in organization's subscription mapping
    const subscriptionIds = organization.stripe_subscription_ids || {}
    const allSubscriptionIds = Object.values(subscriptionIds)
    
    if (!allSubscriptionIds.includes(subscriptionId)) {
      throw new Error(`Subscription not found: ${subscriptionId}`)
    }
    
    // Find which account this subscription belongs to
    let accountId: string | null = null
    for (const [
      acctId,
      subId
    ] of Object.entries(subscriptionIds)) {
      if (subId === subscriptionId) {
        accountId = acctId
        break
      }
    }
    
    if (!accountId) {
      throw new Error(`Account ID not found for subscription: ${subscriptionId}`)
    }
    
    const stripe = getStripeClient()
    if (purchased_product == null) {
    // Cancel subscription with connected account context
      await stripe.subscriptions.cancel(subscriptionId)

      // Update organization to remove this subscription
      const updatedSubscriptionIds = { ...subscriptionIds }
      delete updatedSubscriptionIds[accountId]

      await update<Organization>({
        tableName: process.env.ORGANIZATIONS_TABLE!,
        key: { id: user.organization_id },
        updates: {
          stripe_subscription_ids: updatedSubscriptionIds
        }
      })

      // Mark all purchased products with this subscription as cancelled
      const purchasedProducts = await query<PurchasedProduct>({
        tableName: process.env.PURCHASED_PRODUCTS_TABLE!,
        keyConditionExpression: 'organization_id = :organizationId',
        filterExpression: 'subscription_id = :subscriptionId',
        expressionAttributeValues: {
          ':organizationId': user.organization_id,
          ':subscriptionId': subscriptionId
        }
      })

      for (const product of purchasedProducts.items ?? []) {
        await update<PurchasedProduct>({
          tableName: process.env.PURCHASED_PRODUCTS_TABLE!,
          key: {
            organization_id: product.organization_id,
            id: product.id
          },
          updates: {
            cancelled: true
          }
        })
      }
    } else {
      if (purchased_product.subscription_id !== subscriptionId) {
        throw new Error(`Purchased product subscription ID ${purchased_product.subscription_id} does not match subscription ID ${subscriptionId}`)
      }
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      // find existing item
      const items = subscription.items.data
      const existingItem = items.find(item => item.id === purchased_product.subscription_item_id)
      if (!existingItem) {
        throw new Error(`Subscription item ID ${purchased_product.subscription_item_id} not found in subscription ${subscriptionId}`)
      }
      // will decrementing the quantity leave quantity at zero?
      const newQuantity = (existingItem.quantity ?? 1) - 1
      if (newQuantity === 0) {
        // If quantity is zero, does removing this item leave the subscription empty?
        const isEmpty = items.length === 1
        if (isEmpty) {
          await stripe.subscriptions.cancel(subscriptionId)
        } else {
          await stripe.subscriptionItems.del(existingItem.id)
        }
      } else {
        // Otherwise, just update the quantity
        await stripe.subscriptionItems.update(existingItem.id, {
          quantity: newQuantity
        })
      }

      // Mark the specific purchased product as cancelled
      await update<PurchasedProduct>({
        tableName: process.env.PURCHASED_PRODUCTS_TABLE!,
        key: {
          organization_id: purchased_product.organization_id,
          id: purchased_product.id
        },
        updates: {
          cancelled: true
        }
      })
    }
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      }
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: (error as Error).message }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      }
    }
  }
}