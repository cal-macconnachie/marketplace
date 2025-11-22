import {
  domain, organizationsTableName, platformFeesTableName
} from '@marketplace/constants'
import {
  Organization, PlatformFee
} from '@marketplace/types'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import Stripe from 'stripe'
import { query } from '../../helpers/dynamo-helpers/query'
import { read } from '../../helpers/dynamo-helpers/read'
import { update } from '../../helpers/dynamo-helpers/update'
import { getStripeClient } from '../../helpers/stripe/stripe-client'

const MONTHLY_FEE_AMOUNT = 300 // $3.00 in cents

interface OutstandingFeesInfo {
  fees: PlatformFee[]
  totalAmount: number
  periods: string[]
}

async function getOutstandingFees(organizationId: string): Promise<OutstandingFeesInfo> {
  // Query all unpaid fees for this organization
  const queryResult = await query<PlatformFee>({
    tableName: platformFeesTableName!,
    indexName: 'organization_id-index',
    keyConditionExpression: 'organization_id = :orgId',
    expressionAttributeValues: {
      ':orgId': organizationId
    }
  })

  const fees = queryResult.items || []

  // Filter for unpaid fees (insufficient_funds or failed)
  const unpaidFees = fees.filter(fee =>
    fee.status === 'insufficient_funds' || fee.status === 'failed'
  )

  // Calculate total outstanding amount
  const totalAmount = unpaidFees.reduce((sum, fee) => sum + fee.amount, 0)

  // Get unique fee periods
  const periods = [...new Set(unpaidFees.map(fee => fee.fee_period))]

  return {
    fees: unpaidFees,
    totalAmount,
    periods
  }
}

/**
 * Create a Stripe Checkout session for paying outstanding platform fees
 */
export const createFeePaymentCheckout = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const { organizationId } = JSON.parse(event.body || '{}')

    if (!organizationId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'organizationId is required' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    // Get organization
    const org = await read<Organization>({
      tableName: organizationsTableName!,
      key: { id: organizationId }
    })

    if (!org) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Organization not found' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    // Get outstanding fees
    const { fees, totalAmount, periods } = await getOutstandingFees(organizationId)

    if (totalAmount === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'No outstanding fees'
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    const stripe = getStripeClient()
    const currency = org.currency || 'usd'

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: 'Outstanding Platform Fees',
              description: `Payment for ${periods.length} month(s): ${periods.join(', ')}`
            },
            unit_amount: totalAmount
          },
          quantity: 1
        }
      ],
      success_url: `https://${domain}/platform-fee-payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://${domain}/platform-fee-payment-cancelled`,
      customer_email: org.email,
      metadata: {
        organization_id: organizationId,
        fee_ids: fees.map(f => f.id).join(','),
        total_amount: totalAmount.toString(),
        periods: periods.join(',')
      }
    })

    console.log(`Created checkout session ${session.id} for org ${organizationId}`)

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        checkoutUrl: session.url,
        sessionId: session.id,
        totalAmount,
        periods
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } catch (error) {
    console.error('Error creating fee payment checkout:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
}

/**
 * Handle successful fee payment from Stripe Checkout
 * This should be called from a webhook or success page
 */
export const handleFeePaymentSuccess = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const { sessionId } = JSON.parse(event.body || '{}')

    if (!sessionId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'sessionId is required' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    const stripe = getStripeClient()

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.payment_status !== 'paid') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Payment not completed' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    const organizationId = session.metadata?.organization_id
    const feeIds = session.metadata?.fee_ids?.split(',') || []

    if (!organizationId) {
      throw new Error('Missing organization_id in session metadata')
    }

    // Mark all fees as paid
    for (const feeId of feeIds) {
      const fee = await read<PlatformFee>({
        tableName: platformFeesTableName!,
        key: { id: feeId }
      })

      if (fee && fee.status !== 'success') {
        await update<PlatformFee>({
          tableName: platformFeesTableName!,
          key: {
            id: fee.id,
            created_at: fee.created_at
          },
          updates: {
            status: 'success',
            stripe_transfer_id: session.payment_intent as string,
            updated_at: new Date().toISOString()
          }
        })
      }
    }

    // If account was suspended, reactivate it
    const org = await read<Organization>({
      tableName: organizationsTableName!,
      key: { id: organizationId }
    })

    if (org?.account_suspended) {
      await update<Organization>({
        tableName: organizationsTableName!,
        key: {
          id: org.id,
          created_at: org.created_at
        },
        updates: {
          account_suspended: false,
          suspended_at: '',
          suspended_reason: ''
        }
      })

      console.log(`Reactivated organization ${organizationId} after fee payment`)
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Fees paid successfully',
        feesPaid: feeIds.length
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } catch (error) {
    console.error('Error handling fee payment success:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
}
