import {
  domain, organizationsTableName, platformFeesTableName
} from '@marketplace/constants'
import {
  Organization, PlatformFee
} from '@marketplace/types'
import { ScheduledEvent } from 'aws-lambda'
import Stripe from 'stripe'
import { v4 as uuidv4 } from 'uuid'
import { create } from '../../helpers/dynamo-helpers/create'
import { query } from '../../helpers/dynamo-helpers/query'
import { scan } from '../../helpers/dynamo-helpers/scan'
import { update } from '../../helpers/dynamo-helpers/update'
import { sendEmail } from '../../helpers/emails/send-email'
import { compileTemplate } from '../../helpers/handlebars/compile-template'
import { getStripeClient } from '../../helpers/stripe/stripe-client'

const MONTHLY_FEE_AMOUNT = 300 // $3.00 in cents
const FEE_DESCRIPTION = 'Monthly platform maintenance fee'

interface FeeCollectionResult {
  total: number
  successful: number
  failed: number
  insufficient_funds: number
  errors: Array<{ organization_id: string; error: string }>
}

export const collectMonthlyFees = async (event: ScheduledEvent): Promise<FeeCollectionResult> => {
  console.log('Starting monthly fee collection', { event })

  const stripe = getStripeClient()
  const feePeriod = new Date().toISOString().slice(0, 7) // YYYY-MM

  const result: FeeCollectionResult = {
    total: 0,
    successful: 0,
    failed: 0,
    insufficient_funds: 0,
    errors: []
  }

  try {
    // Step 1: Get all active connected accounts
    const orgs = await getActiveConnectedAccounts()
    result.total = orgs.length

    console.log(`Found ${orgs.length} active connected accounts to process`)

    // Step 2: Process each organization
    for (const org of orgs) {
      try {
        await processSingleOrganization(stripe, org, feePeriod, result)
      } catch (error) {
        console.error(`Failed to process org ${org.id}:`, error)
        result.failed++
        result.errors.push({
          organization_id: org.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        })

        // Record failed attempt
        await recordFeeAttempt(org, feePeriod, 'failed', error)
      }
    }

    // Step 3: Log summary
    console.log('Monthly fee collection complete', result)

    // Send summary email to platform admins
    await sendAdminSummaryEmail(result)

    return result

  } catch (error) {
    console.error('Fatal error in monthly fee collection:', error)
    throw error
  }
}

async function getActiveConnectedAccounts(): Promise<Organization[]> {
  // Get all organizations with connected accounts
  const scanResult = await scan<Organization>({
    tableName: organizationsTableName!,
    filterExpression: 'attribute_exists(stripe_account_id) AND charges_enabled = :true',
    expressionAttributeValues: {
      ':true': true
    }
  })

  return scanResult.items || []
}

async function processSingleOrganization(
  stripe: Stripe,
  org: Organization,
  feePeriod: string,
  result: FeeCollectionResult
): Promise<void> {
  const {
    stripe_account_id, currency = 'usd' 
  } = org

  if (!stripe_account_id) {
    throw new Error('Missing stripe_account_id')
  }

  // Check if already collected this period (idempotency check)
  const existingFee = await checkExistingFee(org.id, feePeriod)
  if (existingFee && existingFee.status === 'success') {
    console.log(`Fee already collected for org ${org.id} in period ${feePeriod}`)
    result.successful++
    return
  }

  // Step 1: Check account balance
  const balance = await stripe.balance.retrieve({
    stripeAccount: stripe_account_id
  })

  const availableBalance = balance.available.find(b => b.currency === currency)?.amount || 0
  console.log(`Account ${stripe_account_id} balance:`, availableBalance, currency)

  if (availableBalance < MONTHLY_FEE_AMOUNT) {
    console.warn(`Insufficient balance for account ${stripe_account_id}`)
    result.insufficient_funds++

    await recordFeeAttempt(
      org,
      feePeriod,
      'insufficient_funds',
      new Error(`Insufficient balance: ${availableBalance} < ${MONTHLY_FEE_AMOUNT}`)
    )

    // Check for consecutive failures and suspend if needed
    const consecutiveFailures = await getConsecutiveFailures(org.id)
    console.log(`Organization ${org.id} has ${consecutiveFailures} consecutive failures`)

    // Suspend account after 2 or more consecutive failures
    if (consecutiveFailures >= 1) {
      console.warn(`Suspending account ${org.id} due to ${consecutiveFailures + 1} consecutive payment failures`)
      await suspendOrganization(org)
      await notifySeller(org, 'suspended', undefined, availableBalance, consecutiveFailures + 1)
    } else {
      // First failure - send insufficient funds notification
      await notifySeller(org, 'insufficient_funds', undefined, availableBalance)
    }

    return
  }

  // Step 2: Create invoice item and invoice for the connected account
  // Note: Stripe Connect platforms should use invoicing to charge maintenance fees
  // See: https://docs.stripe.com/connect/invoices
  const idempotencyKey = `monthly-fee-${org.id}-${feePeriod}`

  // Create invoice item for the maintenance fee
  await stripe.invoiceItems.create({
    customer: stripe_account_id, // Connected account's customer ID on the platform
    amount: MONTHLY_FEE_AMOUNT,
    currency,
    description: FEE_DESCRIPTION,
    metadata: {
      organization_id: org.id,
      fee_type: 'monthly_maintenance',
      fee_period: feePeriod
    }
  }, {
    idempotencyKey: `${idempotencyKey}-item`
  })

  // Create and finalize invoice
  const invoice = await stripe.invoices.create({
    customer: stripe_account_id,
    auto_advance: true, // Automatically finalize and attempt payment
    collection_method: 'charge_automatically',
    metadata: {
      organization_id: org.id,
      fee_period: feePeriod
    }
  }, {
    idempotencyKey
  })

  const invoiceId = invoice.id

  if (!invoiceId) {
    throw new Error('Failed to create invoice')
  }

  // Finalize the invoice (triggers payment attempt)
  const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoiceId)

  console.log(`Successfully created invoice for ${stripe_account_id}:`, finalizedInvoice.id)
  result.successful++

  // Step 3: Record successful collection
  await recordFeeAttempt(org, feePeriod, 'success', undefined, finalizedInvoice.id)

  // Send confirmation email to seller
  await notifySeller(org, 'success', finalizedInvoice)
}

async function checkExistingFee(
  organizationId: string,
  feePeriod: string
): Promise<PlatformFee | null> {
  const queryResult = await query<PlatformFee>({
    tableName: platformFeesTableName!,
    indexName: 'organization_id-index',
    keyConditionExpression: 'organization_id = :orgId AND fee_period = :period',
    expressionAttributeValues: {
      ':orgId': organizationId,
      ':period': feePeriod
    },
    limit: 1
  })

  return queryResult.items?.[0] || null
}

async function getConsecutiveFailures(organizationId: string): Promise<number> {
  // Query all fees for this organization, sorted by fee_period descending (most recent first)
  const queryResult = await query<PlatformFee>({
    tableName: platformFeesTableName!,
    indexName: 'organization_id-index',
    keyConditionExpression: 'organization_id = :orgId',
    expressionAttributeValues: {
      ':orgId': organizationId
    },
    sortOrder: 'DESC'
  })

  const fees = queryResult.items || []

  // Count consecutive insufficient_funds from most recent
  let consecutiveFailures = 0
  for (const fee of fees) {
    if (fee.status === 'insufficient_funds') {
      consecutiveFailures++
    } else {
      // Stop counting when we hit a non-insufficient_funds status
      break
    }
  }

  return consecutiveFailures
}

async function suspendOrganization(org: Organization): Promise<void> {
  console.log(`Suspending organization ${org.id} due to consecutive payment failures`)

  await update<Organization>({
    tableName: organizationsTableName!,
    key: {
      id: org.id
    },
    updates: {
      account_suspended: true,
      suspended_at: new Date().toISOString(),
      suspended_reason: 'Consecutive monthly fee payment failures'
    }
  })

  console.log(`Organization ${org.id} has been suspended`)
}

async function recordFeeAttempt(
  org: Organization,
  feePeriod: string,
  status: PlatformFee['status'],
  error?: unknown,
  transferId?: string
): Promise<void> {
  const fee: PlatformFee = {
    id: uuidv4(),
    organization_id: org.id,
    stripe_account_id: org.stripe_account_id!,
    stripe_transfer_id: transferId,
    amount: MONTHLY_FEE_AMOUNT,
    currency: org.currency || 'usd',
    status,
    error_message: error instanceof Error ? error.message : undefined,
    fee_period: feePeriod,
    created_at: new Date().toISOString()
  }

  await create<PlatformFee>({
    tableName: platformFeesTableName!,
    key: {
      id: fee.id,
      created_at: fee.created_at
    },
    record: fee
  })

  console.log(`Recorded fee attempt:`, fee)
}

// Notify seller of fee collection
async function notifySeller(
  org: Organization,
  status: 'success' | 'insufficient_funds' | 'suspended',
  transfer?: Stripe.Transfer | Stripe.Invoice,
  availableBalance?: number,
  consecutiveFailures?: number
): Promise<void> {
  // Skip if no email
  if (!org.email) {
    console.log(`No email for org ${org.id}, skipping notification`)
    return
  }

  const currency = org.currency || 'usd'
  const feePeriod = new Date().toISOString().slice(0, 7) // YYYY-MM
  const amountFormatted = `${(MONTHLY_FEE_AMOUNT / 100).toFixed(2)} ${currency.toUpperCase()}`

  try {
    if (status === 'success') {
      const html = compileTemplate({
        templatePath: 'platform-fee-success.hbs',
        context: {
          brand: 'Marketplace',
          organization_name: org.name || 'Your Organization',
          amount_formatted: amountFormatted,
          fee_period: feePeriod,
          transfer_id: transfer?.id
        }
      })

      await sendEmail({
        to: org.email,
        from: `Marketplace <no-reply@${domain}>`,
        subject: 'Monthly Platform Fee Collected',
        body: html
      })

      console.log(`Sent success notification to ${org.email}`)
    } else if (status === 'insufficient_funds') {
      const availableBalanceFormatted = availableBalance !== undefined
        ? `${(availableBalance / 100).toFixed(2)} ${currency.toUpperCase()}`
        : 'Unknown'

      const html = compileTemplate({
        templatePath: 'platform-fee-insufficient-funds.hbs',
        context: {
          brand: 'Marketplace',
          organization_name: org.name || 'Your Organization',
          organization_id: org.id,
          amount_formatted: amountFormatted,
          fee_period: feePeriod,
          available_balance_formatted: availableBalanceFormatted,
          domain
        }
      })

      await sendEmail({
        to: org.email,
        from: `Marketplace <no-reply@${domain}>`,
        subject: 'Action Required: Insufficient Funds for Monthly Fee',
        body: html
      })

      console.log(`Sent insufficient funds notification to ${org.email}`)
    } else if (status === 'suspended') {
      const html = compileTemplate({
        templatePath: 'platform-fee-account-suspended.hbs',
        context: {
          brand: 'Marketplace',
          organization_name: org.name || 'Your Organization',
          amount_formatted: amountFormatted,
          suspended_at: new Date().toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
          }),
          consecutive_failures: consecutiveFailures || 2
        }
      })

      await sendEmail({
        to: org.email,
        from: `Marketplace <no-reply@${domain}>`,
        subject: 'URGENT: Account Suspended Due to Payment Failures',
        body: html
      })

      console.log(`Sent account suspended notification to ${org.email}`)
    }
  } catch (error) {
    console.error(`Failed to send notification email to ${org.email}:`, error)
    // Don't throw - email failure shouldn't break fee collection
  }
}

// Send summary to platform admins
async function sendAdminSummaryEmail(result: FeeCollectionResult): Promise<void> {
  const adminEmail = 'cal.macconnachie@gmail.com'

  if (!adminEmail) {
    console.log('ADMIN_EMAIL not set, logging summary instead')
    console.log('Monthly Fee Collection Summary:', JSON.stringify(result, null, 2))
    return
  }

  const feePeriod = new Date().toISOString().slice(0, 7) // YYYY-MM
  const timestamp = new Date().toISOString()

  try {
    const html = compileTemplate({
      templatePath: 'platform-fee-admin-summary.hbs',
      context: {
        brand: 'Marketplace Admin',
        fee_period: feePeriod,
        timestamp: new Date(timestamp).toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short'
        }),
        total: result.total,
        successful: result.successful,
        failed: result.failed,
        insufficient_funds: result.insufficient_funds,
        has_errors: result.errors.length > 0,
        error_count: result.errors.length,
        errors: result.errors
      }
    })

    await sendEmail({
      to: adminEmail,
      from: `Marketplace Admin <no-reply@${domain}>`,
      subject: `Monthly Fee Collection Summary - ${feePeriod}`,
      body: html
    })

    console.log(`Sent admin summary email to ${adminEmail}`)
  } catch (error) {
    console.error('Failed to send admin summary email:', error)
    // Log summary as fallback
    console.log('Monthly Fee Collection Summary:', JSON.stringify(result, null, 2))
  }
}
