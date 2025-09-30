import { EventBridgeEvent } from 'aws-lambda'
import Stripe from 'stripe'
import { getUserByStripeId } from '../helpers/users/get-user-by-stripe-id'
import { updatePurchaseStatus } from '../helpers/carts/update-purchase-status'
import { PurchasedProduct } from './products'
import { createPurchasedProductFromPurchase } from '../helpers/carts/create-purchased-product-from-purchase'
import { getStripeClient } from '../helpers/stripe/stripe-client'
import { create } from '../helpers/dynamo-helpers/create'
import { Purchase } from './purchases'
import { v4 } from 'uuid'
import { batchGet } from '../helpers/dynamo-helpers/batch-get'
import { Product } from './products'
import { get } from '../helpers/dynamo-helpers/get'
import { Organization } from './organizations'
import { adjustPurchaseAmount } from '../helpers/purchases/adjust-purchase-amount'
export interface Cart {
  user_id: string
  id: string
  purchases: { [purchaseId: string]: 'pending' | 'completed' | 'failed' }
  payment_method_id: string
  created_at: string
}

export const stripePlatformEventHandler = async (event: EventBridgeEvent<'Stripe Event', Stripe.Event>) => {
  const type = event.detail.type

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
          try {
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
          } catch (error) {
            // Purchase may already be completed - this is expected for webhook retries
            console.log(`Purchase ${purchaseId} already completed or failed to update:`, error)
          }
        }
      }
      // atomic update users org to add purchased products to purchased_products array
      if (purchasedProducts.length > 0) {
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
          try {
            await updatePurchaseStatus({
              cartId: paymentIntent.metadata?.cart_id,
              userId: user.id,
              purchaseId,
              status: 'failed'
            })
          } catch (error) {
            // Purchase may already be failed/completed - this is expected for webhook retries
            console.log(`Purchase ${purchaseId} already updated or failed to update:`, error)
          }
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
      const invoice = event.detail.data.object
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
      if (customerId) {
        const user = await getUserByStripeId(customerId)
        // Get subscription ID from parent.subscription_details
        const subscriptionId = invoice.parent?.type === 'subscription_details'
          ? (typeof invoice.parent.subscription_details?.subscription === 'string'
            ? invoice.parent.subscription_details.subscription
            : invoice.parent.subscription_details?.subscription?.id)
          : undefined
        if (user && subscriptionId) {
          const purchasedProducts: PurchasedProduct[] = []
          const stripe = getStripeClient()
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          const cartId = subscription.metadata?.cart_id
          const organization = await get<Organization>({
            tableName: process.env.ORGANIZATIONS_TABLE!,
            key: { id: user.organization_id }
          })

          if (!organization) {
            throw new Error(`Organization not found: ${user.organization_id}`)
          }

          // Check billing_reason to distinguish initial purchase from recurring billing
          // subscription_create, subscription_update = initial purchase with pending purchases
          // subscription_cycle = recurring billing, need to create new purchases
          const isInitialPurchase = invoice.billing_reason === 'subscription_create' ||
                                     invoice.billing_reason === 'subscription_update'

          if (isInitialPurchase) {
            // Initial purchase - update existing pending purchases to completed
            for (const item of invoice.lines.data) {
              const subscriptionItemId = item.parent?.subscription_item_details?.subscription_item
              if (subscriptionItemId) {
                const subscriptionItem = await stripe.subscriptionItems.retrieve(subscriptionItemId)
                const purchaseIds = JSON.parse(subscriptionItem.metadata?.purchase_ids ?? '[]')

                // Calculate per-item amounts from invoice line item
                const quantity = item.quantity || 1
                const totalAmount = item.amount + (item.taxes?.reduce((sum, tax) => sum + tax.amount, 0) ?? 0)
                const perItemTotal = Math.round(totalAmount / quantity)

                for (const purchaseId of purchaseIds) {
                  try {
                    // Get the purchase to adjust amounts
                    const purchase = await get<Purchase>({
                      tableName: process.env.PURCHASES_TABLE!,
                      key: {
                        user_id: user.id,
                        id: purchaseId
                      }
                    })

                    if (purchase) {
                      // Adjust purchase amount to match Stripe's calculation
                      await adjustPurchaseAmount({
                        purchase,
                        correctAmount: perItemTotal
                      })
                    }

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
                  } catch (error) {
                    // Purchase may already be completed - this is expected for webhook retries
                    console.log(`Purchase ${purchaseId} already completed or failed to update:`, error)
                  }
                }
              }
            }
          } else {
            // Recurring billing (subscription_cycle) - create new completed purchases
            // Get all unique products from invoice line items
            const productKeys: Array<{ id: string, group_id: string }> = []
            for (const item of invoice.lines.data) {
              const subscriptionItemId = item.parent?.subscription_item_details?.subscription_item
              if (subscriptionItemId) {
                const subscriptionItem = await stripe.subscriptionItems.retrieve(subscriptionItemId)
                const metadata = subscriptionItem.metadata || {}
                if (metadata.product_id && metadata.product_group_id) {
                  productKeys.push({
                    id: metadata.product_id,
                    group_id: metadata.product_group_id
                  })
                }
              }
            }

            const products = productKeys.length > 0 ? await batchGet<Product>({
              tableName: process.env.PRODUCTS_TABLE!,
              keys: productKeys
            }) : []

            const productsById = products.reduce((acc, p) => {
              acc[`${p.group_id}:${p.id}`] = p
              return acc
            }, {} as { [key: string]: Product })

            for (const item of invoice.lines.data) {
              const subscriptionItemId = item.parent?.subscription_item_details?.subscription_item
              if (subscriptionItemId) {
                const subscriptionItem = await stripe.subscriptionItems.retrieve(subscriptionItemId)
                const productKey = `${subscriptionItem.metadata?.product_group_id}:${subscriptionItem.metadata?.product_id}`
                const product = productsById[productKey]

                if (product) {
                  const quantity = item.quantity || 1
                  const taxAmount = item.taxes?.reduce((sum: number, tax) => sum + tax.amount, 0) || 0
                  // Create a purchase for each quantity
                  for (let i = 0; i < quantity; i++) {
                    const newPurchase: Purchase = {
                      id: v4(),
                      user_id: user.id,
                      product_id: product.id,
                      product_group_id: product.group_id,
                      product_name: product.name,
                      is_one_time: false,
                      is_subscription: true,
                      purchased_at: new Date().toISOString(),
                      organization_id: user.organization_id,
                      payment_method_id: typeof subscription.default_payment_method === 'string'
                        ? subscription.default_payment_method
                        : subscription.default_payment_method?.id || '',
                      amount: item.amount,
                      currency: item.currency,
                      platform_fee_amount: item.amount * (subscription.application_fee_percent || 0) / 100,
                      connected_account_id: product.account_id,
                      tax_amount: taxAmount,
                      base_amount: item.amount - taxAmount,
                      seller_organization_id: product.metadata?.organization_id,
                      status: 'completed'
                    }

                    await create<Purchase>({
                      tableName: process.env.PURCHASES_TABLE!,
                      key: {
                        user_id: newPurchase.user_id,
                        id: newPurchase.id
                      },
                      record: newPurchase
                    })

                    purchasedProducts.push(await createPurchasedProductFromPurchase({
                      purchaseKey: {
                        userId: user.id,
                        purchaseId: newPurchase.id
                      },
                      subscriptionItem
                    }))
                  }
                }
              }
            }
          }

          if (purchasedProducts.length > 0) {
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
      }

      console.log(`Invoice paid for customer ${customerId}, billing_reason: ${invoice.billing_reason}, amount: ${invoice.amount_paid} ${invoice.currency}`)
      break
    }

    case 'invoice.payment_failed': {
      // Handle failed subscription payments
      const invoice = event.detail.data.object as Stripe.Invoice
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
      if (customerId) {
        const user = await getUserByStripeId(customerId)
        // Get subscription ID from parent.subscription_details
        const subscriptionId = invoice.parent?.type === 'subscription_details'
          ? (typeof invoice.parent.subscription_details?.subscription === 'string'
            ? invoice.parent.subscription_details.subscription
            : invoice.parent.subscription_details?.subscription?.id)
          : undefined
        if (user && subscriptionId) {
          const stripe = getStripeClient()
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          const cartId = subscription.metadata?.cart_id
          const organization = await get<Organization>({
            tableName: process.env.ORGANIZATIONS_TABLE!,
            key: { id: user.organization_id }
          })

          if (!organization) {
            throw new Error(`Organization not found: ${user.organization_id}`)
          }

          // Check billing_reason to distinguish initial purchase from recurring billing
          const isInitialPurchase = invoice.billing_reason === 'subscription_create' ||
                                     invoice.billing_reason === 'subscription_update'

          if (isInitialPurchase) {
            // Initial purchase - update existing pending purchases to failed
            for (const item of invoice.lines.data) {
              const subscriptionItemId = item.parent?.subscription_item_details?.subscription_item
              if (subscriptionItemId) {
                const subscriptionItem = await stripe.subscriptionItems.retrieve(subscriptionItemId)
                const purchaseIds = JSON.parse(subscriptionItem.metadata?.purchase_ids ?? '[]')
                for (const purchaseId of purchaseIds) {
                  try {
                    await updatePurchaseStatus({
                      cartId,
                      userId: user.id,
                      purchaseId,
                      status: 'failed'
                    })
                  } catch (error) {
                    // Purchase may already be failed/completed - this is expected for webhook retries
                    console.log(`Purchase ${purchaseId} already updated or failed to update:`, error)
                  }
                }
              }
            }
          } else {
            // Recurring billing (subscription_cycle) - create new failed purchases
            // Get all unique products from invoice line items
            const productKeys: Array<{ id: string, group_id: string }> = []
            for (const item of invoice.lines.data) {
              const subscriptionItemId = item.parent?.subscription_item_details?.subscription_item
              if (subscriptionItemId) {
                const subscriptionItem = await stripe.subscriptionItems.retrieve(subscriptionItemId)
                const metadata = subscriptionItem.metadata || {}
                if (metadata.product_id && metadata.product_group_id) {
                  productKeys.push({
                    id: metadata.product_id,
                    group_id: metadata.product_group_id
                  })
                }
              }
            }

            const products = productKeys.length > 0 ? await batchGet<Product>({
              tableName: process.env.PRODUCTS_TABLE!,
              keys: productKeys
            }) : []

            const productsById = products.reduce((acc, p) => {
              acc[`${p.group_id}:${p.id}`] = p
              return acc
            }, {} as { [key: string]: Product })

            for (const item of invoice.lines.data) {
              const subscriptionItemId = item.parent?.subscription_item_details?.subscription_item
              if (subscriptionItemId) {
                const subscriptionItem = await stripe.subscriptionItems.retrieve(subscriptionItemId)
                const productKey = `${subscriptionItem.metadata?.product_group_id}:${subscriptionItem.metadata?.product_id}`
                const product = productsById[productKey]

                if (product) {
                  const quantity = item.quantity || 1
                  const taxAmount = item.taxes?.reduce((sum: number, tax) => sum + tax.amount, 0) || 0
                  // Create a failed purchase for each quantity
                  for (let i = 0; i < quantity; i++) {
                    const newPurchase: Purchase = {
                      id: v4(),
                      user_id: user.id,
                      product_id: product.id,
                      product_group_id: product.group_id,
                      product_name: product.name,
                      is_one_time: false,
                      is_subscription: true,
                      purchased_at: new Date().toISOString(),
                      organization_id: user.organization_id,
                      payment_method_id: typeof subscription.default_payment_method === 'string'
                        ? subscription.default_payment_method
                        : subscription.default_payment_method?.id || '',
                      amount: item.amount,
                      currency: item.currency,
                      platform_fee_amount: item.amount * (subscription.application_fee_percent || 0) / 100,
                      connected_account_id: product.account_id,
                      tax_amount: taxAmount,
                      base_amount: item.amount - taxAmount,
                      seller_organization_id: product.metadata?.organization_id,
                      status: 'failed'
                    }

                    await create<Purchase>({
                      tableName: process.env.PURCHASES_TABLE!,
                      key: {
                        user_id: newPurchase.user_id,
                        id: newPurchase.id
                      },
                      record: newPurchase
                    })
                  }
                }
              }
            }
          }
        }
      }

      console.log(`Invoice payment failed for customer ${customerId}, billing_reason: ${invoice.billing_reason}, amount: ${invoice.amount_due} ${invoice.currency}`)
      break
    }
    default: {
      console.log(`Unhandled platform event type: ${type}`)
      break
    }
  }
}
