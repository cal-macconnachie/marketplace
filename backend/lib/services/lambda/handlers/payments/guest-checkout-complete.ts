import {
  organizationsTableName,
  paymentMethodsTableName
} from '@marketplace/constants'
import {
  Organization,
  PaymentMethod
} from '@marketplace/types'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { get } from '../../helpers/dynamo-helpers/get'
import { update } from '../../helpers/dynamo-helpers/update'
import {
  checkRateLimit,
  getRateLimitKey
} from '../../helpers/rate-limiting/dynamo-rate-limiter'
import { purchaseProducts } from '../../helpers/stripe/purchase-products'
import { getStripeClient } from '../../helpers/stripe/stripe-client'

interface GuestCheckoutCompleteRequest {
  userId: string
  paymentMethodId: string
  productKeys: Array<{
    id: string
    group_id: string
  }>
  promoCode?: string
  couponId?: string
  shippingAddress?: {
    full_name: string
    address_line1: string
    address_line2?: string
    city: string
    state: string
    postal_code: string
    country: string
  }
}

/**
 * Completes a guest checkout after 3DS verification has been completed.
 * This endpoint is called after the user has successfully verified their payment method.
 */
export const guestCheckoutComplete = async (event: APIGatewayProxyEvent) => {
  try {
    // Get client IP for rate limiting
    const clientIp = event.requestContext.identity.sourceIp ||
                     event.headers['X-Forwarded-For']?.split(',')[0]?.trim() ||
                     event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                     '0.0.0.0'

    // Rate limiting check
    const rateLimitKey = getRateLimitKey('guest_checkout_complete', clientIp)
    const rateLimitResult = await checkRateLimit(rateLimitKey, {
      windowMs: 60 * 1000, // 1 minute window
      maxRequests: 10 // Allow more attempts for completion
    })

    if (!rateLimitResult.allowed) {
      return {
        statusCode: 429,
        body: JSON.stringify({
          error: 'Too many requests. Please try again later.',
          resetTime: new Date(rateLimitResult.resetTime).toISOString()
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': Math.floor(rateLimitResult.resetTime / 1000).toString()
        }
      }
    }

    const body = JSON.parse(event.body || '{}') as GuestCheckoutCompleteRequest

    // Validate required fields
    if (!body.userId || !body.paymentMethodId || !body.productKeys || body.productKeys.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing required fields: userId, paymentMethodId, and productKeys are required'
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    // Get the payment method to verify it exists and belongs to the user
    const paymentMethod = await get<PaymentMethod>({
      tableName: paymentMethodsTableName!,
      key: {
        user_id: body.userId,
        id: body.paymentMethodId
      }
    })

    if (!paymentMethod) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: 'Payment method not found'
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    // Get the stripe client and verify the payment method is properly attached
    const stripe = getStripeClient()

    try {
      const stripePaymentMethod = await stripe.paymentMethods.retrieve(body.paymentMethodId)

      // If payment method is still pending verification in our DB, check Stripe's status
      // and update it if the verification succeeded (race condition with webhook)
      if (paymentMethod.status === 'pending_verification') {
        let successfulSetupIntent = null
        let attempts = 0
        const maxAttempts = 2 // Initial attempt + 1 retry

        // Try to find successful SetupIntent, with one retry after 3 seconds
        while (attempts < maxAttempts && !successfulSetupIntent) {
          if (attempts > 0) {
            console.log(`Attempt ${attempts + 1}/${maxAttempts}: Waiting 3 seconds before checking SetupIntent status...`)
            await new Promise(resolve => setTimeout(resolve, 3000))
          }

          const setupIntents = await stripe.setupIntents.list({
            payment_method: body.paymentMethodId,
            limit: 1
          })

          successfulSetupIntent = setupIntents.data.find(si => si.status === 'succeeded')
          attempts++
        }

        if (!successfulSetupIntent) {
          // Verification truly hasn't completed yet after retries
          return {
            statusCode: 400,
            body: JSON.stringify({
              error: 'Payment method verification is still pending. Please try again in a moment.'
            }),
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Credentials': true,
              'Content-Type': 'application/json'
            }
          }
        }

        // SetupIntent succeeded, update our DB to match Stripe's state
        await update<PaymentMethod>({
          tableName: paymentMethodsTableName!,
          key: {
            user_id: body.userId,
            id: body.paymentMethodId
          },
          updates: {
            status: 'active'
          }
        })

        console.log(`Updated payment method ${body.paymentMethodId} to active after detecting successful SetupIntent (attempts: ${attempts})`)
      }

      if (!stripePaymentMethod.customer) {
        // Payment method not attached to customer, do it now
        const userPaymentMethods = await get<PaymentMethod[]>({
          tableName: paymentMethodsTableName!,
          key: { user_id: body.userId }
        })

        if (userPaymentMethods && userPaymentMethods.length > 0) {
          // Get stripe customer ID from any payment method
          const customerStripeId = stripePaymentMethod.customer

          if (customerStripeId) {
            await stripe.paymentMethods.attach(body.paymentMethodId, {
              customer: customerStripeId as string
            })

            await stripe.customers.update(customerStripeId as string, {
              invoice_settings: {
                default_payment_method: body.paymentMethodId
              }
            })
          }
        }
      }
    } catch (stripeError) {
      console.error('Error verifying Stripe payment method:', stripeError)
      // Continue anyway - the payment method might still work
    }

    // Update organization default payment method if not set
    // We need to get the user to find their organization
    const organization = await get<Organization>({
      tableName: organizationsTableName!,
      key: { id: paymentMethod.user_id } // Assuming org_id can be derived from payment method
    })

    if (organization && !organization.default_payment_method) {
      await update<Organization>({
        tableName: organizationsTableName!,
        key: { id: organization.id },
        updates: {
          default_payment_method: {
            id: paymentMethod.id,
            user_id: body.userId
          }
        }
      })
    }

    // Process the purchase
    await purchaseProducts({
      userId: body.userId,
      paymentMethodId: body.paymentMethodId,
      productKeys: body.productKeys,
      promoCode: body.promoCode,
      couponId: body.couponId,
      ipAddress: clientIp,
      shippingAddress: body.shippingAddress
    })

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Purchase completed successfully'
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }

  } catch (error) {
    console.error('Error in guest checkout complete:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to complete guest checkout',
        message: (error as Error).message
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
}
