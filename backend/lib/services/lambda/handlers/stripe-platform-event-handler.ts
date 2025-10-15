import {
  organizationsTableName,
  paymentMethodsTableName,
  productsTableName, purchasedProductsTableName, purchasesTableName, usersTableName
} from '@marketplace/constants'
import {
  Organization,
  PaymentMethod,
  Product,
  Purchase,
  PurchasedProduct,
  User
} from '@marketplace/types'
import { EventBridgeEvent } from 'aws-lambda'
import Stripe from 'stripe'
import { v4 } from 'uuid'
import { createPurchasedProductForMeterSubscription } from '../helpers/carts/create-purchased-product-for-meter-subscription'
import { createPurchasedProductFromPurchase } from '../helpers/carts/create-purchased-product-from-purchase'
import { queryPurchasedProductsBySubscriptionItem } from '../helpers/carts/query-purchased-products-by-subscription-item'
import { updatePurchaseStatus } from '../helpers/carts/update-purchase-status'
import { updatePurchasedProductFromPurchase } from '../helpers/carts/update-purchased-product-from-purchase'
import { createPurchaseCart } from '../helpers/create-purchase-cart'
import { batchGet } from '../helpers/dynamo-helpers/batch-get'
import { create } from '../helpers/dynamo-helpers/create'
import { get } from '../helpers/dynamo-helpers/get'
import { update } from '../helpers/dynamo-helpers/update'
import { adjustPurchaseAmount } from '../helpers/purchases/adjust-purchase-amount'
import { calculatePlatformFee } from '../helpers/stripe/calculate-platform-fee'
import { getStripeClient } from '../helpers/stripe/stripe-client'
import { getUserByStripeId } from '../helpers/users/get-user-by-stripe-id'

export const stripePlatformEventHandler = async (event: EventBridgeEvent<'Stripe Event', Stripe.Event>) => {
  const type = event.detail.type

  switch (type) {
    case 'setup_intent.succeeded': {
      // Handle successful payment method verification
      const setupIntent = event.detail.data.object as Stripe.SetupIntent
      const userId = setupIntent.metadata?.user_id
      const paymentMethodId = setupIntent.metadata?.payment_method_id ||
                             (typeof setupIntent.payment_method === 'string'
                               ? setupIntent.payment_method
                               : setupIntent.payment_method?.id)

      if (userId && paymentMethodId) {
        try {
          // Get the payment method from DynamoDB
          const paymentMethod = await get<PaymentMethod>({
            tableName: paymentMethodsTableName!,
            key: {
              user_id: userId,
              id: paymentMethodId
            }
          })

          if (paymentMethod && paymentMethod.status === 'pending_verification') {
            const stripe = getStripeClient()
            const customerId = typeof setupIntent.customer === 'string'
              ? setupIntent.customer
              : setupIntent.customer?.id

            if (customerId) {
              // Attach payment method and set as default
              await stripe.paymentMethods.attach(paymentMethodId, {
                customer: customerId
              })
              await stripe.customers.update(customerId, {
                invoice_settings: {
                  default_payment_method: paymentMethodId
                }
              })

              // Update payment method status to active
              await update<PaymentMethod>({
                tableName: paymentMethodsTableName!,
                key: {
                  user_id: userId,
                  id: paymentMethodId
                },
                updates: {
                  status: 'active',
                  verified_on_session: true
                }
              })

              // Get user and org to set as org default if needed
              const user = await get<User>({
                tableName: usersTableName!,
                key: { id: userId }
              })

              if (user) {
                const org = await get<Organization>({
                  tableName: organizationsTableName!,
                  key: { id: user.organization_id }
                })

                if (org && org.default_payment_method == null) {
                  await update<Organization>({
                    tableName: organizationsTableName!,
                    key: { id: org.id },
                    updates: {
                      default_payment_method: {
                        id: paymentMethodId,
                        user_id: userId
                      }
                    }
                  })
                }
              }

              console.log(`Payment method ${paymentMethodId} verified and activated for user ${userId}`)
            }
          }
        } catch (error) {
          console.error(`Error handling setup_intent.succeeded for payment method ${paymentMethodId}:`, error)
        }
      }
      break
    }

    case 'setup_intent.setup_failed': {
      // Handle failed payment method verification
      const setupIntent = event.detail.data.object as Stripe.SetupIntent
      const userId = setupIntent.metadata?.user_id
      const paymentMethodId = setupIntent.metadata?.payment_method_id ||
                             (typeof setupIntent.payment_method === 'string'
                               ? setupIntent.payment_method
                               : setupIntent.payment_method?.id)

      if (userId && paymentMethodId) {
        try {
          // Get the payment method from DynamoDB
          const paymentMethod = await get<PaymentMethod>({
            tableName: paymentMethodsTableName!,
            key: {
              user_id: userId,
              id: paymentMethodId
            }
          })

          if (paymentMethod && paymentMethod.status === 'pending_verification') {
            // Update payment method status to failed
            await update<PaymentMethod>({
              tableName: paymentMethodsTableName!,
              key: {
                user_id: userId,
                id: paymentMethodId
              },
              updates: {
                status: 'failed',
              }
            })

            console.log(`Payment method ${paymentMethodId} verification failed for user ${userId}. Reason: ${setupIntent.last_setup_error?.message || 'Unknown'}`)
          }
        } catch (error) {
          console.error(`Error handling setup_intent.setup_failed for payment method ${paymentMethodId}:`, error)
        }
      }
      break
    }

    case 'payment_intent.succeeded': {
      // one time payments
      const paymentIntent = event.detail.data.object as Stripe.PaymentIntent
      const customerId = typeof paymentIntent.customer === 'string' ? paymentIntent.customer : paymentIntent.customer?.id
      const user = await getUserByStripeId(customerId!)

      const purchaseIds = paymentIntent.metadata?.purchase_ids ? JSON.parse(paymentIntent.metadata.purchase_ids) : []
      const purchasedProducts: PurchasedProduct[] = []

      // Extract the charge ID from the payment intent
      // PaymentIntent.latest_charge is a string ID (not an object)
      const chargeId = typeof paymentIntent.latest_charge === 'string'
        ? paymentIntent.latest_charge
        : undefined

      for (const purchaseId of purchaseIds) {
        if (user) {
          try {
            await updatePurchaseStatus({
              cartId: paymentIntent.metadata?.cart_id,
              userId: user.id,
              purchaseId,
              status: 'completed',
              destinationChargeId: chargeId
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
        const createPromises = purchasedProducts.map(product => create<PurchasedProduct>({
          tableName: purchasedProductsTableName!,
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

    case 'payment_intent.requires_action': {
      // Handle payment intents that require additional action (3DS, etc.)
      const paymentIntent = event.detail.data.object as Stripe.PaymentIntent
      const customerId = typeof paymentIntent.customer === 'string' ? paymentIntent.customer : paymentIntent.customer?.id
      const user = await getUserByStripeId(customerId!)

      const purchaseIds = paymentIntent.metadata?.purchase_ids ? JSON.parse(paymentIntent.metadata.purchase_ids) : []
      for (const purchaseId of purchaseIds) {
        if (user) {
          try {
            // Get the purchase to add requires_action data
            const purchase = await get<Purchase>({
              tableName: purchasesTableName!,
              key: {
                user_id: user.id,
                id: purchaseId
              }
            })

            if (purchase) {
              // Update purchase with requires_action information
              await update<Purchase>({
                tableName: purchasesTableName!,
                key: {
                  user_id: user.id,
                  id: purchaseId
                },
                updates: {
                  requires_action: {
                    payment_intent_id: paymentIntent.id,
                    client_secret: paymentIntent.client_secret || '',
                    next_action: paymentIntent.next_action
                  }
                }
              })

              console.log(`Added requires_action to purchase ${purchaseId} for PaymentIntent ${paymentIntent.id}`)
            }
          } catch (error) {
            console.error(`Failed to update purchase ${purchaseId} with requires_action:`, error)
          }
        }
      }

      console.log(`PaymentIntent ${paymentIntent.id} requires action for customer ${customerId}`)
      break
    }
    
    case 'transfer.created': {
      const transfer = event.detail.data.object as Stripe.Transfer

      console.log(`Transfer created: ${transfer.id} to destination ${transfer.destination}`)

      // Update purchase records with transfer_id for tracking
      // This helps with reconciliation and refund handling
      try {
        const stripe = getStripeClient()

        // Get the source transaction (charge) to find the associated purchase_ids
        const sourceTransactionId = typeof transfer.source_transaction === 'string'
          ? transfer.source_transaction
          : transfer.source_transaction?.id

        if (sourceTransactionId) {
          // Retrieve the charge to get metadata with purchase_ids
          const charge = await stripe.charges.retrieve(sourceTransactionId)

          // Check if this charge came from a PaymentIntent (one-time payments)
          if (charge.payment_intent) {
            const paymentIntentId = typeof charge.payment_intent === 'string'
              ? charge.payment_intent
              : charge.payment_intent.id

            const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
            const purchaseIds = paymentIntent.metadata?.purchase_ids
              ? JSON.parse(paymentIntent.metadata.purchase_ids)
              : []

            // Update all purchases with this transfer_id
            for (const purchaseId of purchaseIds) {
              try {
                // Get the purchase to find the user_id
                const purchase = await get<Purchase>({
                  tableName: purchasesTableName!,
                  key: {
                    user_id: paymentIntent.metadata?.user_id || '',
                    id: purchaseId
                  }
                })

                if (purchase) {
                  await update<Purchase>({
                    tableName: purchasesTableName!,
                    key: {
                      user_id: purchase.user_id,
                      id: purchaseId
                    },
                    updates: {
                      transfer_id: transfer.id
                    }
                  })

                  console.log(`Updated purchase ${purchaseId} with transfer_id ${transfer.id}`)
                }
              } catch (error) {
                console.error(`Failed to update purchase ${purchaseId} with transfer_id:`, error)
              }
            }
          } else {
            // For subscription payments, the charge might not have a payment_intent
            // but the invoice should have metadata
            console.log(`Charge ${sourceTransactionId} has no payment_intent - may be a subscription charge`)
          }
        }
      } catch (error) {
        console.error(`Error handling transfer.created for ${transfer.id}:`, error)
      }

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
    
    case 'invoice.finalized': {
      // Apply platform fee to all subscription invoices before they're charged
      const invoice = event.detail.data.object as Stripe.Invoice
      const subscriptionId = invoice.parent?.type === 'subscription_details'
        ? (typeof invoice.parent.subscription_details?.subscription === 'string'
          ? invoice.parent.subscription_details.subscription
          : invoice.parent.subscription_details?.subscription?.id)
        : undefined

      if (subscriptionId && invoice.total > 0 && invoice.id) {
        try {
          const stripe = getStripeClient()
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          const connectedAccountId = subscription.metadata?.connected_account_id

          // Only apply fee if this is for a connected account (destination charge)
          if (connectedAccountId) {
            // Get the seller organization from the first line item
            let sellerOrgId: string | undefined
            for (const item of invoice.lines.data) {
              const subscriptionItemId = item.parent?.subscription_item_details?.subscription_item
              if (subscriptionItemId) {
                const subscriptionItem = await stripe.subscriptionItems.retrieve(subscriptionItemId)
                const productGroupId = subscriptionItem.metadata?.product_group_id
                const productId = subscriptionItem.metadata?.product_id

                if (productGroupId && productId) {
                  const product = await get<Product>({
                    tableName: productsTableName!,
                    key: {
                      group_id: productGroupId,
                      id: productId
                    }
                  })

                  if (product?.metadata?.organization_id) {
                    sellerOrgId = product.metadata.organization_id
                    break
                  }
                }
              }
            }

            // Calculate the correct platform fee using our helper
            const platformFeePercent = await calculatePlatformFee({
              amount: invoice.total,
              organizationId: sellerOrgId,
              subscription: true
            })

            const applicationFeeAmount = Math.round(invoice.total * (platformFeePercent / 100))

            await stripe.invoices.update(invoice.id, {
              application_fee_amount: applicationFeeAmount
            })

            console.log(`Applied platform fee of ${applicationFeeAmount} (${platformFeePercent}%) to subscription invoice ${invoice.id}`)
          }
        } catch (error) {
          console.error(`Error applying platform fee to invoice ${invoice.id}:`, error)
        }
      }
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
            tableName: organizationsTableName!,
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

          // Extract charge ID from invoice payments for refund tracking
          // Invoices store charges in payments.data array
          let chargeId: string | undefined
          if (invoice.payments?.data && invoice.payments.data.length > 0) {
            const latestPayment = invoice.payments.data[0]
            if (latestPayment.payment) {
              if (latestPayment.payment.type === 'charge' && latestPayment.payment.charge) {
                // Charge ID is a string when type is 'charge'
                chargeId = typeof latestPayment.payment.charge === 'string'
                  ? latestPayment.payment.charge
                  : undefined
              } else if (latestPayment.payment.type === 'payment_intent' && latestPayment.payment.payment_intent) {
                // For payment intents, we need to fetch it to get the charge ID
                const paymentIntentId = typeof latestPayment.payment.payment_intent === 'string'
                  ? latestPayment.payment.payment_intent
                  : undefined

                if (paymentIntentId) {
                  try {
                    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
                    // PaymentIntent.latest_charge is a string ID
                    chargeId = typeof paymentIntent.latest_charge === 'string'
                      ? paymentIntent.latest_charge
                      : undefined
                  } catch (error) {
                    console.error(`Failed to retrieve payment intent ${paymentIntentId}:`, error)
                  }
                }
              }
            }
          }

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
                      tableName: purchasesTableName!,
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
                      status: 'completed',
                      destinationChargeId: chargeId
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
              tableName: productsTableName!,
              keys: productKeys
            }) : []

            const productsById = products.reduce((acc, p) => {
              acc[`${p.group_id}:${p.id}`] = p
              return acc
            }, {} as { [key: string]: Product })

            const newPurchasedProductsToCreate: PurchasedProduct[] = []
            // Track all new purchases by subscription item to create carts
            const purchasesBySubscriptionItem: { [subscriptionItemId: string]: string[] } = {}

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
                          tableName: purchasesTableName!,
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
                            status: 'completed',
                            destinationChargeId: chargeId
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
                            type: 'metered_subscription',
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
                            seller_organization_id: product.organization_id,
                            status: 'pending' // Pending for next period's usage
                          }

                          await create<Purchase>({
                            tableName: purchasesTableName!,
                            key: {
                              user_id: newPurchase.user_id,
                              id: newPurchase.id
                            },
                            record: newPurchase
                          })

                          // Track new purchase for cart creation
                          if (!purchasesBySubscriptionItem[subscriptionItemId]) {
                            purchasesBySubscriptionItem[subscriptionItemId] = []
                          }
                          purchasesBySubscriptionItem[subscriptionItemId].push(newPurchase.id)

                          // Reset the purchased product amount to zero and update purchase_id for next period
                          await update({
                            tableName: purchasedProductsTableName!,
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
                        type: 'subscription',
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
                        seller_organization_id: product.organization_id,
                        status: 'completed'
                      }

                      await create<Purchase>({
                        tableName: purchasesTableName!,
                        key: {
                          user_id: newPurchase.user_id,
                          id: newPurchase.id
                        },
                        record: newPurchase
                      })

                      // Track new purchase for cart creation
                      if (!purchasesBySubscriptionItem[subscriptionItemId]) {
                        purchasesBySubscriptionItem[subscriptionItemId] = []
                      }
                      purchasesBySubscriptionItem[subscriptionItemId].push(newPurchase.id)

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
              const createPromises = newPurchasedProductsToCreate.map(product => create<PurchasedProduct>({
                tableName: purchasedProductsTableName!,
                key: {
                  organization_id: user?.organization_id,
                  id: product.id
                },
                record: product
              }))
              await Promise.all(createPromises)
            }

            // Create carts for all new purchases (recurring billing)
            for (const [
              subscriptionItemId,
              purchaseIds
            ] of Object.entries(purchasesBySubscriptionItem)) {
              if (purchaseIds.length > 0) {
                try {
                  const purchases = purchaseIds.reduce((acc, purchaseId) => {
                    acc[purchaseId] = 'completed'
                    return acc
                  }, {} as { [purchaseId: string]: 'completed' | 'pending' | 'failed' })

                  const cart = await createPurchaseCart({
                    userId: user.id,
                    purchases,
                    paymentMethodId: typeof subscription.default_payment_method === 'string'
                      ? subscription.default_payment_method
                      : subscription.default_payment_method?.id || ''
                  })

                  console.log(`Created cart ${cart.id} for ${purchaseIds.length} recurring billing purchases`)
                } catch (error) {
                  console.error(`Failed to create cart for subscription item ${subscriptionItemId}:`, error)
                }
              }
            }
          }

          // For initial purchases, create all purchased products
          if (isInitialPurchase && purchasedProducts.length > 0) {
            const createPromises = purchasedProducts.map(product => create<PurchasedProduct>({
              tableName: purchasedProductsTableName!,
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
            tableName: organizationsTableName!,
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
                      tableName: purchasesTableName!,
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
            // Track all new failed purchases by subscription item to create carts
            const purchasesBySubscriptionItem: { [subscriptionItemId: string]: string[] } = {}
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
              tableName: productsTableName!,
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
                const isMeteredSubscription = subscriptionItem.price?.recurring?.usage_type === 'metered'

                if (product) {
                  const quantity = item.quantity || 1
                  const taxAmount = item.taxes?.reduce((sum: number, tax) => sum + tax.amount, 0) || 0

                  if (isMeteredSubscription) {
                    // For metered subscriptions, find the pending purchase via the purchased product and fail it
                    const existingPurchasedProducts = await queryPurchasedProductsBySubscriptionItem({
                      subscriptionItemId
                    })

                    const existingPurchasedProduct = existingPurchasedProducts[0]
                    if (existingPurchasedProduct) {
                      try {
                        const purchase = await get<Purchase>({
                          tableName: purchasesTableName!,
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

                          // Mark purchase as failed
                          await updatePurchaseStatus({
                            cartId: purchase.cart_id || cartId,
                            userId: user.id,
                            purchaseId: purchase.id,
                            status: 'failed'
                          })

                          console.log(`Marked metered subscription purchase ${purchase.id} as failed`)
                        }
                      } catch (error) {
                        console.log(`Failed to update metered subscription purchase ${existingPurchasedProduct.purchase_id}:`, error)
                      }
                    }
                  } else {
                    // Create a failed purchase for each quantity (non-metered subscriptions only)
                    for (let i = 0; i < quantity; i++) {
                      const newPurchase: Purchase = {
                        id: v4(),
                        user_id: user.id,
                        product_id: product.id,
                        product_group_id: product.group_id,
                        product_name: product.name,
                        type: 'subscription',
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
                        seller_organization_id: product.organization_id,
                        status: 'failed'
                      }

                      await create<Purchase>({
                        tableName: purchasesTableName!,
                        key: {
                          user_id: newPurchase.user_id,
                          id: newPurchase.id
                        },
                        record: newPurchase
                      })

                      // Track new failed purchase for cart creation
                      if (!purchasesBySubscriptionItem[subscriptionItemId]) {
                        purchasesBySubscriptionItem[subscriptionItemId] = []
                      }
                      purchasesBySubscriptionItem[subscriptionItemId].push(newPurchase.id)
                    }
                  }
                }
              }
            }

            // Create carts for all failed purchases (recurring billing)
            for (const [
              subscriptionItemId,
              purchaseIds
            ] of Object.entries(purchasesBySubscriptionItem)) {
              if (purchaseIds.length > 0) {
                try {
                  const purchases = purchaseIds.reduce((acc, purchaseId) => {
                    acc[purchaseId] = 'failed'
                    return acc
                  }, {} as { [purchaseId: string]: 'completed' | 'pending' | 'failed' })

                  const cart = await createPurchaseCart({
                    userId: user.id,
                    purchases,
                    paymentMethodId: typeof subscription.default_payment_method === 'string'
                      ? subscription.default_payment_method
                      : subscription.default_payment_method?.id || ''
                  })

                  console.log(`Created cart ${cart.id} for ${purchaseIds.length} failed recurring billing purchases`)
                } catch (error) {
                  console.error(`Failed to create cart for subscription item ${subscriptionItemId}:`, error)
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
            console.log(item)
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
              tableName: purchasedProductsTableName!,
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
              tableName: purchasedProductsTableName!,
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
