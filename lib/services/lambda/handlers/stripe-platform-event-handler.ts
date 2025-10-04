import { EventBridgeEvent } from 'aws-lambda'
import Stripe from 'stripe'
import { getUserByStripeId } from '../helpers/users/get-user-by-stripe-id'
import { updatePurchaseStatus } from '../helpers/carts/update-purchase-status'
import { PurchasedProduct } from './products'
import { createPurchasedProductFromPurchase } from '../helpers/carts/create-purchased-product-from-purchase'
import { createPurchasedProductForMeterSubscription } from '../helpers/carts/create-purchased-product-for-meter-subscription'
import { getStripeClient } from '../helpers/stripe/stripe-client'
import { create } from '../helpers/dynamo-helpers/create'
import { Purchase } from './purchases'
import { v4 } from 'uuid'
import { batchGet } from '../helpers/dynamo-helpers/batch-get'
import { Product } from './products'
import { get } from '../helpers/dynamo-helpers/get'
import { update } from '../helpers/dynamo-helpers/update'
import { Organization } from './organizations'
import { adjustPurchaseAmount } from '../helpers/purchases/adjust-purchase-amount'
import { queryPurchasedProductsBySubscriptionItem } from '../helpers/carts/query-purchased-products-by-subscription-item'
import { updatePurchasedProductFromPurchase } from '../helpers/carts/update-purchased-product-from-purchase'
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
            // Initial purchase - update existing pending purchases to completed (non-metered only)
            for (const item of invoice.lines.data) {
              const subscriptionItemId = item.parent?.subscription_item_details?.subscription_item
              if (subscriptionItemId) {
                const subscriptionItem = await stripe.subscriptionItems.retrieve(subscriptionItemId)
                const purchaseIds = JSON.parse(subscriptionItem.metadata?.purchase_ids ?? '[]')
                const isMeteredSubscription = subscriptionItem.price?.recurring?.usage_type === 'metered'

                // Skip metered subscriptions - they're handled by customer.subscription.created/updated events
                if (isMeteredSubscription) {
                  continue
                }

                // Calculate per-item amounts from invoice line item
                const quantity = item.quantity || 1
                const totalAmount = item.amount + (item.taxes?.reduce((sum, tax) => sum + tax.amount, 0) ?? 0)
                const perItemTotal = Math.abs(Math.round((totalAmount) / quantity))

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

                    // Use the purchase's cart_id instead of subscription metadata
                    // (items added to existing subscriptions have different cart_ids)
                    await updatePurchaseStatus({
                      cartId: purchase?.cart_id || cartId,
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

                // Remove completed purchase IDs and store purchased_product_ids cumulatively
                if (subscriptionItemId && purchaseIds.length > 0) {
                  try {
                    // Get existing purchased_product_ids from metadata
                    const existingPurchasedProductIds = JSON.parse(subscriptionItem.metadata?.purchased_product_ids ?? '[]')
                    const newPurchasedProductIds = purchasedProducts.map(p => p.id)
                    const allPurchasedProductIds = [
                      ...existingPurchasedProductIds,
                      ...newPurchasedProductIds
                    ]

                    await stripe.subscriptionItems.update(subscriptionItemId, {
                      metadata: {
                        purchase_ids: JSON.stringify([]),
                        purchased_product_ids: JSON.stringify(allPurchasedProductIds)
                      }
                    })
                  } catch (error) {
                    console.log(`Failed to update metadata for subscription item ${subscriptionItemId}:`, error)
                  }
                }
              }
            }
          } else {
            // Recurring billing (subscription_cycle) - handle metered vs non-metered subscriptions differently
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

            const newPurchasedProductsToCreate: PurchasedProduct[] = []

            for (const item of invoice.lines.data) {
              const subscriptionItemId = item.parent?.subscription_item_details?.subscription_item
              if (subscriptionItemId) {
                const subscriptionItem = await stripe.subscriptionItems.retrieve(subscriptionItemId)
                const productKey = `${subscriptionItem.metadata?.product_group_id}:${subscriptionItem.metadata?.product_id}`
                const product = productsById[productKey]
                const isMeteredSubscription = subscriptionItem.price?.recurring?.usage_type === 'metered'

                if (product) {
                  const quantity = item.quantity || 1
                  const taxAmount = item.taxes?.reduce((sum: number, tax) => sum + tax.amount, 0) || 0

                  // Query existing purchased products for this subscription item
                  const existingPurchasedProducts = await queryPurchasedProductsBySubscriptionItem({
                    subscriptionItemId
                  })

                  if (isMeteredSubscription) {
                    // For metered subscriptions, find the pending purchase via the purchased product
                    const existingPurchasedProduct = existingPurchasedProducts[0]

                    if (existingPurchasedProduct) {
                      try {
                        const purchase = await get<Purchase>({
                          tableName: process.env.PURCHASES_TABLE!,
                          key: {
                            user_id: user.id,
                            id: existingPurchasedProduct.purchase_id
                          }
                        })

                        if (purchase && purchase.status === 'pending') {
                          const totalAmount = item.amount + taxAmount

                          // Adjust purchase amount to match actual usage
                          await adjustPurchaseAmount({
                            purchase,
                            correctAmount: totalAmount
                          })

                          // Mark purchase as completed
                          await updatePurchaseStatus({
                            cartId: purchase.cart_id || cartId,
                            userId: user.id,
                            purchaseId: purchase.id,
                            status: 'completed'
                          })

                          // Update the existing purchased product with new amount
                          await updatePurchasedProductFromPurchase({
                            existingPurchasedProduct,
                            purchase: {
                              ...purchase, amount: totalAmount
                            },
                            subscriptionItem
                          })

                          // Create a new pending purchase for the next billing period
                          const newPurchase: Purchase = {
                            id: v4(),
                            user_id: user.id,
                            product_id: product.id,
                            product_group_id: product.group_id,
                            product_name: product.name,
                            is_one_time: false,
                            is_subscription: true,
                            is_metered_subscription: true,
                            purchased_at: new Date().toISOString(),
                            organization_id: user.organization_id,
                            payment_method_id: typeof subscription.default_payment_method === 'string'
                              ? subscription.default_payment_method
                              : subscription.default_payment_method?.id || '',
                            amount: 0, // Start at zero for next period
                            currency: item.currency,
                            platform_fee_amount: 0,
                            connected_account_id: product.account_id,
                            tax_amount: 0,
                            base_amount: 0,
                            seller_organization_id: product.metadata?.organization_id,
                            status: 'pending' // Pending for next period's usage
                          }

                          await create<Purchase>({
                            tableName: process.env.PURCHASES_TABLE!,
                            key: {
                              user_id: newPurchase.user_id,
                              id: newPurchase.id
                            },
                            record: newPurchase
                          })

                          // Reset the purchased product amount to zero and update purchase_id for next period
                          await update({
                            tableName: process.env.PURCHASED_PRODUCTS_TABLE!,
                            key: {
                              organization_id: existingPurchasedProduct.organization_id,
                              id: existingPurchasedProduct.id
                            },
                            updates: {
                              amount: 0,
                              purchase_id: newPurchase.id,
                              in_good_standing_until: subscriptionItem.current_period_end,
                              updated_at: new Date().toISOString()
                            }
                          })

                          console.log(`Created new pending purchase ${newPurchase.id} for next billing period of metered subscription`)
                        }
                      } catch (error) {
                        console.log(`Failed to update metered subscription purchase ${existingPurchasedProduct.purchase_id}:`, error)
                      }
                    }
                  } else {
                    // For non-metered subscriptions, create a new purchase for each quantity
                    for (let i = 0; i < quantity; i++) {
                      const newPurchase: Purchase = {
                        id: v4(),
                        user_id: user.id,
                        product_id: product.id,
                        product_group_id: product.group_id,
                        product_name: product.name,
                        is_one_time: false,
                        is_subscription: true,
                        is_metered_subscription: false,
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

                      // Update existing purchased product if found, otherwise create new
                      const existingPurchasedProduct = existingPurchasedProducts[i]
                      if (existingPurchasedProduct) {
                        // Update happens in this function - no need to batch later
                        await updatePurchasedProductFromPurchase({
                          existingPurchasedProduct,
                          purchase: newPurchase,
                          subscriptionItem
                        })
                      } else {
                        // Fallback: create new purchased product if not found (shouldn't happen for recurring)
                        const newPurchasedProduct = await createPurchasedProductFromPurchase({
                          purchaseKey: {
                            userId: user.id,
                            purchaseId: newPurchase.id
                          },
                          subscriptionItem
                        })
                        newPurchasedProductsToCreate.push(newPurchasedProduct)
                      }
                    }
                  }
                }
              }
            }

            // Only create purchased products that didn't exist before (fallback case)
            if (newPurchasedProductsToCreate.length > 0) {
              const createPromises = newPurchasedProductsToCreate.map(product => create({
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

          // For initial purchases, create all purchased products
          if (isInitialPurchase && purchasedProducts.length > 0) {
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
            const purchasedProducts: PurchasedProduct[] = []
            for (const item of invoice.lines.data) {
              const subscriptionItemId = item.parent?.subscription_item_details?.subscription_item
              if (subscriptionItemId) {
                const subscriptionItem = await stripe.subscriptionItems.retrieve(subscriptionItemId)
                const purchaseIds = JSON.parse(subscriptionItem.metadata?.purchase_ids ?? '[]')
                for (const purchaseId of purchaseIds) {
                  try {
                    // Get the purchase to use its cart_id
                    const purchase = await get<Purchase>({
                      tableName: process.env.PURCHASES_TABLE!,
                      key: {
                        user_id: user.id,
                        id: purchaseId
                      }
                    })

                    // Use the purchase's cart_id instead of subscription metadata
                    // (items added to existing subscriptions have different cart_ids)
                    await updatePurchaseStatus({
                      cartId: purchase?.cart_id || cartId,
                      userId: user.id,
                      purchaseId,
                      status: 'failed'
                    })

                    // Track purchased products even for failures (for metadata consistency)
                    try {
                      const purchasedProduct = await createPurchasedProductFromPurchase({
                        purchaseKey: {
                          userId: user.id,
                          purchaseId
                        },
                        subscriptionItem
                      })
                      purchasedProducts.push(purchasedProduct)
                    } catch (error) {
                      console.log(`Failed to create purchased product for failed purchase ${purchaseId}:`, error)
                    }
                  } catch (error) {
                    // Purchase may already be failed/completed - this is expected for webhook retries
                    console.log(`Purchase ${purchaseId} already updated or failed to update:`, error)
                  }
                }

                // Store purchased_product_ids cumulatively even for failed purchases
                if (subscriptionItemId && purchaseIds.length > 0) {
                  try {
                    // Get existing purchased_product_ids from metadata
                    const existingPurchasedProductIds = JSON.parse(subscriptionItem.metadata?.purchased_product_ids ?? '[]')
                    const newPurchasedProductIds = purchasedProducts.map(p => p.id)
                    const allPurchasedProductIds = [
                      ...existingPurchasedProductIds,
                      ...newPurchasedProductIds
                    ]

                    await stripe.subscriptionItems.update(subscriptionItemId, {
                      metadata: {
                        purchase_ids: JSON.stringify([]),
                        purchased_product_ids: JSON.stringify(allPurchasedProductIds)
                      }
                    })
                  } catch (error) {
                    console.log(`Failed to update metadata for subscription item ${subscriptionItemId}:`, error)
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
                      is_metered_subscription: product.default_price_data?.recurring?.usage_type === 'metered',
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

    case 'customer.subscription.created': {
      // Handle metered subscription creation - create zero-dollar purchased products immediately
      const subscription = event.detail.data.object as Stripe.Subscription
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id

      if (customerId) {
        const user = await getUserByStripeId(customerId)
        if (user) {
          const purchasedProducts: PurchasedProduct[] = []

          // Process each subscription item
          for (const item of subscription.items.data) {
            const isMeteredSubscription = item.price?.recurring?.usage_type === 'metered'

            // Only process metered subscriptions
            if (isMeteredSubscription) {
              const purchaseIds = JSON.parse(item.metadata?.purchase_ids ?? '[]')

              for (const purchaseId of purchaseIds) {
                try {
                  const purchasedProduct = await createPurchasedProductForMeterSubscription({
                    purchaseKey: {
                      userId: user.id,
                      purchaseId
                    },
                    subscriptionItem: item
                  })
                  purchasedProducts.push(purchasedProduct)
                } catch (error) {
                  console.log(`Failed to create purchased product for metered subscription purchase ${purchaseId}:`, error)
                }
              }

              // Store purchased_product_ids in subscription item metadata
              if (item.id && purchaseIds.length > 0) {
                try {
                  const stripe = getStripeClient()
                  const purchasedProductIds = purchasedProducts.map(p => p.id)

                  await stripe.subscriptionItems.update(item.id, {
                    metadata: {
                      purchase_ids: JSON.stringify([]),
                      purchased_product_ids: JSON.stringify(purchasedProductIds)
                    }
                  })
                } catch (error) {
                  console.log(`Failed to update metadata for subscription item ${item.id}:`, error)
                }
              }
            }
          }

          // Create all purchased products
          if (purchasedProducts.length > 0) {
            const createPromises = purchasedProducts.map(product => create({
              tableName: process.env.PURCHASED_PRODUCTS_TABLE!,
              key: {
                organization_id: user.organization_id,
                id: product.id
              },
              record: product
            }))
            await Promise.all(createPromises)
          }

          console.log(`Created ${purchasedProducts.length} purchased products for metered subscription ${subscription.id}`)
        }
      }
      break
    }

    case 'customer.subscription.updated': {
      // Handle adding metered subscription items to existing subscriptions
      const subscription = event.detail.data.object as Stripe.Subscription
      const previousAttributes = event.detail.data.previous_attributes as Partial<Stripe.Subscription> | undefined
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id

      // Only process if items were added/changed
      if (customerId && previousAttributes?.items) {
        const user = await getUserByStripeId(customerId)
        if (user) {
          const purchasedProducts: PurchasedProduct[] = []

          // Process each subscription item
          for (const item of subscription.items.data) {
            const isMeteredSubscription = item.price?.recurring?.usage_type === 'metered'

            // Only process metered subscriptions with pending purchase_ids
            if (isMeteredSubscription) {
              const purchaseIds = JSON.parse(item.metadata?.purchase_ids ?? '[]')

              // Only create purchased products if there are pending purchase_ids
              if (purchaseIds.length > 0) {
                for (const purchaseId of purchaseIds) {
                  try {
                    const purchasedProduct = await createPurchasedProductForMeterSubscription({
                      purchaseKey: {
                        userId: user.id,
                        purchaseId
                      },
                      subscriptionItem: item
                    })
                    purchasedProducts.push(purchasedProduct)
                  } catch (error) {
                    console.log(`Failed to create purchased product for metered subscription purchase ${purchaseId}:`, error)
                  }
                }

                // Store purchased_product_ids in subscription item metadata
                if (item.id) {
                  try {
                    const stripe = getStripeClient()
                    const existingPurchasedProductIds = JSON.parse(item.metadata?.purchased_product_ids ?? '[]')
                    const newPurchasedProductIds = purchasedProducts.map(p => p.id)
                    const allPurchasedProductIds = [
                      ...existingPurchasedProductIds,
                      ...newPurchasedProductIds
                    ]

                    await stripe.subscriptionItems.update(item.id, {
                      metadata: {
                        purchase_ids: JSON.stringify([]),
                        purchased_product_ids: JSON.stringify(allPurchasedProductIds)
                      }
                    })
                  } catch (error) {
                    console.log(`Failed to update metadata for subscription item ${item.id}:`, error)
                  }
                }
              }
            }
          }

          // Create all purchased products
          if (purchasedProducts.length > 0) {
            const createPromises = purchasedProducts.map(product => create({
              tableName: process.env.PURCHASED_PRODUCTS_TABLE!,
              key: {
                organization_id: user.organization_id,
                id: product.id
              },
              record: product
            }))
            await Promise.all(createPromises)
          }

          console.log(`Created ${purchasedProducts.length} purchased products for updated metered subscription ${subscription.id}`)
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
