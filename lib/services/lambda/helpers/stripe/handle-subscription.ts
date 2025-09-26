import Stripe from 'stripe'
import { Purchase } from '../../handlers/purchases'
import { User } from '../../handlers/users'
import { getOrganizationById } from '../organizations/get-organization-by-id'
import { getStripeClient } from './stripe-client'
import { batchGet } from '../dynamo-helpers/batch-get'
import { Product } from '../../handlers/products'
import { getProductPriceId } from './get-product-price-id'
import { update } from '../dynamo-helpers/update'
import { Organization } from '../../handlers/organizations'

export const handleSubscription = async ({
  purchases,
  user
}: {
  purchases: Purchase[]
  user: User
}) => {
  const organization = await getOrganizationById(user.organization_id)
  const destinationAccountId = purchases[0].connected_account_id
  if (organization == null) {
    throw new Error('Organization not found')
  }
  if (!destinationAccountId) {
    throw new Error('Destination account ID not found')
  }
  const uniqueProductKeys = Object.values(purchases.reduce((acc: { [key: string]: {[key: string]: string} }, p) => {
    const key = `${p.product_group_id}:${p.product_id}`
    acc[key] = {
      id: p.product_id,
      group_id: p.product_group_id
    }
    return acc
  }, {}))
  const products = await batchGet<Product>({
    tableName: process.env.PRODUCTS_TABLE!,
    keys: uniqueProductKeys
  })
  const pricesHash = (await Promise.all(products.map(async (product) => {
    return {
      key: `${product.group_id}:${product.id}`,
      price: await getProductPriceId(product)
    }
  }))).reduce((acc: { [productKey: string]: string }, curr) => {
    acc[curr.key] = curr.price
    return acc
  }, {})
  const stripe = getStripeClient()
  // creates subscription with items if none exists for organization
  // adds items to current subscription if it exists for organization
  const items: Stripe.SubscriptionCreateParams.Item[] = Object.values(purchases.reduce((acc: { [key: string]: Stripe.SubscriptionCreateParams.Item }, p) => {
    const key = `${p.product_group_id}:${p.product_id}`
    if (acc[key] == null) {
      acc[key] = {
        price: pricesHash[key] || '',
        quantity: 0,
        metadata: {
          purchases: JSON.stringify([])
        }
      }
    }
    if (acc[key] != null && acc[key].quantity != null) {
      acc[key].quantity += 1
    }
    // add purchase id to metadata
    if (acc[key] != null && acc[key].metadata != null) {
      acc[key].metadata.purchases = JSON.stringify([
        ...JSON.parse(`${acc[key].metadata.purchases}`),
        p.id
      ])
    }
    return acc
  }, {}))
  let amount = purchases.reduce((sum, p) => sum + p.amount, 0)
  const platformFee = purchases.reduce((sum, p) => sum + (p.platform_fee_amount ?? 0), 0)
  const platformFeePercent = Number(((platformFee / amount) * 100).toFixed(2))

  const subscriptionId = organization.stripe_subscription_ids?.[destinationAccountId]
  let subscription: Stripe.Subscription | undefined
  if (subscriptionId) {
    // update subscription with new items
    subscription = await stripe.subscriptions.retrieve(subscriptionId)
    // find any items with matching price ids to update quantities
    const subscriptionItems = subscription.items.data
    for (const item of items) {
      const matchingItem = subscriptionItems.find(i => i.price.id === item.price)
      if (matchingItem) {
        // update item with new quantity
        const newQuantity = (matchingItem.quantity ?? 1) + (item.quantity ?? 1)
        await stripe.subscriptionItems.update(matchingItem.id, {
          quantity: newQuantity
        })
      } else {
        // create new item in subscription
        await stripe.subscriptionItems.create({
          subscription: subscription.id,
          price: item.price,
          quantity: item.quantity
        })
      }
    }
  } else {
    // create new subscription with items
    const customer = user.stripe_id
    if (customer == null) {
      throw new Error('Customer not found on user record')
    }
    const cartId = purchases[0].cart_id
    const paymentMethodId = purchases[0].payment_method_id
    const createParams: Stripe.SubscriptionCreateParams = {
      customer,
      items,
      collection_method: 'charge_automatically',
      payment_behavior: 'allow_incomplete',
      ...(paymentMethodId ? { default_payment_method: paymentMethodId } : {}),
      metadata: {
        connected_account_id: destinationAccountId,
        ...(cartId ? { cart_id: cartId } : {})
      },
      automatic_tax: {
        enabled: true,
        liability: {
          type: 'account', account: destinationAccountId 
        },
      },
      transfer_data: { destination: destinationAccountId },
      on_behalf_of: destinationAccountId,
      application_fee_percent: platformFeePercent
    }
    console.log(`Creating subscription for organization ${organization.id} with params:`, JSON.stringify(createParams))
    subscription = await stripe.subscriptions.create(createParams)
  }
  // add subscription id to organization if it was created
  if (subscription && !subscriptionId) {
    await update<Organization>({
      tableName: process.env.ORGANIZATIONS_TABLE!,
      key: { id: organization.id },
      updates: {
        stripe_subscription_ids: {
          ...organization.stripe_subscription_ids,
          [destinationAccountId]: subscription.id 
        }
      }
    })
  }
}
