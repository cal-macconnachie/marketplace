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
      price: await getProductPriceId(product),
      isMetered: product.default_price_data?.recurring?.usage_type === 'metered'
    }
  }))).reduce((acc: { [productKey: string]: { priceId: string, isMetered: boolean } }, curr) => {
    acc[curr.key] = {
      priceId: curr.price,
      isMetered: curr.isMetered
    }
    return acc
  }, {})
  const stripe = getStripeClient()
  // creates subscription with items if none exists for organization
  // adds items to current subscription if it exists for organization
  const items: Stripe.SubscriptionCreateParams.Item[] = Object.values(purchases.reduce((acc: { [key: string]: Stripe.SubscriptionCreateParams.Item }, p) => {
    const key = `${p.product_group_id}:${p.product_id}`
    const priceInfo = pricesHash[key]
    const isMetered = priceInfo?.isMetered || false

    if (acc[key] == null) {
      const item: Stripe.SubscriptionCreateParams.Item = {
        price: priceInfo?.priceId || '',
        metadata: {
          purchase_ids: JSON.stringify([]),
          product_id: p.product_id,
          product_group_id: p.product_group_id
        }
      }
      // Only set quantity for non-metered subscriptions
      if (!isMetered) {
        item.quantity = 0
      }
      acc[key] = item
    }
    // Increment quantity only for non-metered subscriptions
    if (acc[key] != null && !isMetered && acc[key].quantity != null) {
      acc[key].quantity += 1
    }
    // add purchase id to metadata
    if (acc[key] != null && acc[key].metadata != null) {
      acc[key].metadata.purchase_ids = JSON.stringify([
        ...JSON.parse(`${acc[key].metadata.purchase_ids}`),
        p.id
      ])
    }
    return acc
  }, {}))
  let amount = purchases.reduce((sum, p) => sum + p.amount, 0)
  const platformFee = purchases.reduce((sum, p) => sum + (p.platform_fee_amount ?? 0), 0)
  const platformFeePercent = amount > 0 ? Number(((platformFee / amount) * 100).toFixed(2)) : 0

  const subscriptionId = organization.stripe_subscription_ids?.[destinationAccountId]
  let subscription: Stripe.Subscription | undefined
  if (subscriptionId) {
    // update subscription with new items
    subscription = await stripe.subscriptions.retrieve(subscriptionId)
    // find any items with matching price ids to update quantities
    const subscriptionItems = subscription.items.data
    for (const item of items) {
      const matchingItem = subscriptionItems.find(i => i.price.id === item.price)
      const isMetered = item.quantity === undefined // If quantity is undefined, it's a metered subscription

      if (matchingItem) {
        // update item with new metadata and quantity (if non-metered)
        const updateParams: Stripe.SubscriptionItemUpdateParams = {
          proration_behavior: 'always_invoice',
          metadata: {
            ...matchingItem.metadata,
            purchase_ids: JSON.stringify([
              ...JSON.parse(matchingItem.metadata?.purchase_ids ?? '[]'),
              ...JSON.parse(String(item.metadata?.purchase_ids ?? '[]'))
            ]),
            product_id: item.metadata?.product_id || '',
            product_group_id: item.metadata?.product_group_id || ''
          }
        }

        // Only update quantity for non-metered subscriptions
        if (!isMetered) {
          const newQuantity = (matchingItem.quantity ?? 1) + (item.quantity ?? 1)
          updateParams.quantity = newQuantity
        }

        await stripe.subscriptionItems.update(matchingItem.id, updateParams)
      } else {
        // create new item in subscription
        const createParams: Stripe.SubscriptionItemCreateParams = {
          subscription: subscription.id,
          price: item.price,
          proration_behavior: 'always_invoice',
          metadata: item.metadata
        }

        // Only set quantity for non-metered subscriptions
        if (!isMetered) {
          createParams.quantity = item.quantity
        }

        await stripe.subscriptionItems.create(createParams)
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
        ...(cartId ? { cart_id: cartId } : {}),
        purchases: JSON.stringify(purchases.map(p => p.id))
      },
      automatic_tax: {
        enabled: true,
        liability: {
          type: 'account', account: destinationAccountId
        },
      },
      transfer_data: { destination: destinationAccountId },
      on_behalf_of: destinationAccountId,
      ...(platformFeePercent > 0 ? { application_fee_percent: platformFeePercent } : {})
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

  // Status will be updated to 'completed' via invoice.paid webhook
  // Status will be updated to 'failed' via invoice.payment_failed webhook
}
