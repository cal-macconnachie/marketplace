# Monthly Fee Collection Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing a monthly $3 maintenance fee collection system from Stripe connected accounts. The system will automatically transfer funds from each active connected account to the platform account on the 1st of each month.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture](#architecture)
3. [Step 1: Create DynamoDB Table](#step-1-create-dynamodb-table)
4. [Step 2: Add Scheduled Lambda Endpoint](#step-2-add-scheduled-lambda-endpoint)
5. [Step 3: Create Lambda Handler](#step-3-create-lambda-handler)
6. [Step 4: Testing](#step-4-testing)
7. [Step 5: Monitoring & Notifications](#step-5-monitoring--notifications)
8. [Step 6: Deploy](#step-6-deploy)
9. [Additional Considerations](#additional-considerations)

---

## Prerequisites

- Stripe account with platform capabilities
- Connected accounts using Express or Custom account types
- AWS account with appropriate permissions
- Existing infrastructure: DynamoDB, Lambda, EventBridge

## Architecture

```
EventBridge (Cron)  →  Lambda Function  →  Stripe API
                            ↓
                       DynamoDB (Record Keeping)
                            ↓
                       Email Notifications
```

**Schedule**: Runs on the 1st of each month at 2:00 AM UTC

---

## Step 1: Create DynamoDB Table

### Create `platform_fees` Table Definition

**File**: `backend/lib/services/dynamodb/table-definitions.ts`

Add the following table definition:

```typescript
{
  tableName: 'platform_fees',
  partitionKey: { name: 'id', type: AttributeType.STRING },
  sortKey: { name: 'created_at', type: AttributeType.STRING },
  globalSecondaryIndexes: [
    {
      indexName: 'organization_id-index',
      partitionKey: { name: 'organization_id', type: AttributeType.STRING },
      sortKey: { name: 'fee_period', type: AttributeType.STRING }
    },
    {
      indexName: 'fee_period-index',
      partitionKey: { name: 'fee_period', type: AttributeType.STRING },
      sortKey: { name: 'created_at', type: AttributeType.STRING }
    },
    {
      indexName: 'status-index',
      partitionKey: { name: 'status', type: AttributeType.STRING },
      sortKey: { name: 'created_at', type: AttributeType.STRING }
    }
  ],
  stream: StreamViewType.NEW_AND_OLD_IMAGES
}
```

### Add TypeScript Type

**File**: `packages/types/src/index.ts` (or appropriate types file)

```typescript
export interface PlatformFee {
  id: string // UUID
  organization_id: string
  stripe_account_id: string
  stripe_transfer_id?: string
  amount: number // in cents (300 = $3.00)
  currency: string
  status: 'success' | 'failed' | 'insufficient_funds' | 'pending'
  error_message?: string
  fee_period: string // YYYY-MM format
  created_at: string // ISO timestamp
  updated_at?: string
}
```

### Add Constant

**File**: `packages/constants/src/index.ts`

```typescript
export const platformFeesTableName = process.env.PLATFORM_FEES_TABLE_NAME
```

---

## Step 2: Add Scheduled Lambda Endpoint

**File**: `backend/lib/services/lambda/endpoint-definitions/events-endpoints.ts`

Add to the `eventsEndpoints` array:

```typescript
{
  name: 'monthlyAccountFees',
  handler: 'stripe/collect-monthly-fees.collectMonthlyFees',
  description: 'Collect monthly $3 maintenance fees from all active connected accounts',
  environment: [
    'STRIPE_SECRET_KEY',
    'PLATFORM_FEES_TABLE_NAME',
    'ORGANIZATIONS_TABLE_NAME',
    'EMAIL_LAMBDA_ARN',
    'EMAIL_AWS_REGION',
    'EMAIL_ASSUME_ROLE_ARN'
  ],
  scheduleEvent: {
    schedule: 'cron(0 2 1 * ? *)', // 1st of month at 2 AM UTC
    enabled: true,
    description: 'Collect monthly maintenance fees'
  },
  iamPolicies: [
    {
      actions: [
        'dynamodb:Query',
        'dynamodb:Scan',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem'
      ],
      resources: ['*']
    },
    {
      actions: ['sts:AssumeRole'],
      resources: ['arn:aws:iam::472312425428:role/cross-dev-lambdaInvokeFrom-629891807011']
    }
  ],
  timeout: 300 // 5 minutes (may process many accounts)
}
```

**Note**: Adjust the cron schedule if needed:
- `cron(0 2 1 * ? *)` = 1st day of month at 2 AM UTC
- `cron(0 10 1 * ? *)` = 1st day of month at 10 AM UTC

---

## Step 3: Create Lambda Handler

**File**: `backend/lib/services/lambda/handlers/stripe/collect-monthly-fees.ts`

```typescript
import { organizationsTableName, platformFeesTableName } from '@marketplace/constants'
import { Organization, PlatformFee } from '@marketplace/types'
import { ScheduledEvent } from 'aws-lambda'
import Stripe from 'stripe'
import { v4 as uuidv4 } from 'uuid'
import { scan } from '../../helpers/dynamo-helpers/scan'
import { put } from '../../helpers/dynamo-helpers/put'
import { query } from '../../helpers/dynamo-helpers/query'
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

    // TODO: Send summary email to platform admins
    // await sendAdminSummaryEmail(result)

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
  const { stripe_account_id, currency = 'usd' } = org

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

    // TODO: Send notification to seller
    // await notifySeller(org, 'insufficient_funds')

    return
  }

  // Step 2: Create transfer from connected account to platform
  const idempotencyKey = `monthly-fee-${org.id}-${feePeriod}`

  const transfer = await stripe.transfers.create({
    amount: MONTHLY_FEE_AMOUNT,
    currency,
    description: FEE_DESCRIPTION,
    metadata: {
      organization_id: org.id,
      fee_type: 'monthly_maintenance',
      fee_period: feePeriod
    }
  }, {
    stripeAccount: stripe_account_id,
    idempotencyKey
  })

  console.log(`Successfully collected fee from ${stripe_account_id}:`, transfer.id)
  result.successful++

  // Step 3: Record successful collection
  await recordFeeAttempt(org, feePeriod, 'success', undefined, transfer.id)

  // TODO: Send confirmation email to seller
  // await notifySeller(org, 'success', transfer)
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

  await put<PlatformFee>({
    tableName: platformFeesTableName!,
    item: fee
  })

  console.log(`Recorded fee attempt:`, fee)
}
```

---

## Step 4: Testing

### Test in Stripe Test Mode

1. **Create test connected accounts** using Stripe's test mode
2. **Add test balance** to connected accounts using Stripe CLI:
   ```bash
   stripe topups create \
     --amount=1000 \
     --currency=usd \
     --description="Test balance" \
     --stripe-account=acct_xxxxx
   ```

3. **Manually trigger Lambda** (don't wait for cron):
   ```bash
   cd backend
   aws lambda invoke \
     --function-name marketplace-dev-monthlyAccountFees \
     --payload '{}' \
     --cli-binary-format raw-in-base64-out \
     response.json

   cat response.json
   ```

4. **Verify in Stripe Dashboard**:
   - Check Transfers in each connected account
   - Verify $3 appeared in platform account

5. **Check DynamoDB**:
   - Query `platform_fees` table
   - Verify records created with correct status

### Test Scenarios

- ✅ **Happy path**: Account with sufficient balance
- ✅ **Insufficient funds**: Account with < $3 balance
- ✅ **Idempotency**: Run twice in same month, should not double-charge
- ✅ **Currency handling**: Test with CAD, EUR accounts
- ✅ **Inactive accounts**: Verify charges_enabled: false accounts are skipped

---

## Step 5: Monitoring & Notifications

### Add Email Notification Helper

**File**: `backend/lib/services/lambda/handlers/stripe/collect-monthly-fees.ts`

Add these functions:

```typescript
// Add at the top with imports
import { invokeEmailLambda } from '../../helpers/email-helpers' // Create if doesn't exist

// Notify seller of fee collection
async function notifySeller(
  org: Organization,
  status: 'success' | 'insufficient_funds',
  transfer?: Stripe.Transfer
): Promise<void> {
  // TODO: Implement email notification
  // Use EMAIL_LAMBDA_ARN from environment
  console.log(`TODO: Send email to org ${org.id} - status: ${status}`)
}

// Send summary to platform admins
async function sendAdminSummaryEmail(result: FeeCollectionResult): Promise<void> {
  // TODO: Implement admin summary email
  const summary = `
    Monthly Fee Collection Summary

    Total Accounts: ${result.total}
    Successful: ${result.successful}
    Failed: ${result.failed}
    Insufficient Funds: ${result.insufficient_funds}

    Errors:
    ${result.errors.map(e => `- Org ${e.organization_id}: ${e.error}`).join('\n')}
  `

  console.log('TODO: Send admin summary:', summary)
}
```

### CloudWatch Alarms

Create alarms for:
- Lambda execution failures
- High number of insufficient_funds cases
- Zero successful collections (potential bug)

---

## Step 6: Deploy

### Deploy Infrastructure Stack First

```bash
cd backend
yarn cdk deploy MarketplaceInfrastructureStack --context envName=dev
```

This creates the `platform_fees` table.

### Deploy Lambda Stack

```bash
yarn cdk deploy MarketplaceLambdaStack --context envName=dev
```

This deploys the scheduled Lambda function.

### Verify Deployment

1. **Check EventBridge Rule**:
   ```bash
   aws events list-rules --name-prefix marketplace-dev-monthlyAccountFees
   ```

2. **Check Lambda exists**:
   ```bash
   aws lambda get-function --function-name marketplace-dev-monthlyAccountFees
   ```

3. **View CloudWatch Logs**:
   ```bash
   aws logs tail /aws/lambda/marketplace-dev-monthlyAccountFees --follow
   ```

---

## Additional Considerations

### 1. Compliance & Legal

- ✅ Update Terms of Service to mention $3 monthly fee
- ✅ Notify existing connected accounts of upcoming charges (30-day notice)
- ✅ Provide clear fee breakdown in seller dashboard

### 2. Grace Period Implementation

Add logic to handle insufficient funds gracefully:

```typescript
// Track consecutive failures
if (status === 'insufficient_funds') {
  const failureCount = await getConsecutiveFailures(org.id)

  if (failureCount >= 3) {
    // Suspend account after 3 months of non-payment
    await suspendAccount(org)
    await notifySeller(org, 'account_suspended')
  }
}
```

### 3. Fee Refunds

Create a manual refund handler for customer service:

```typescript
// backend/lib/services/lambda/handlers/stripe/refund-platform-fee.ts
export const refundPlatformFee = async (feeId: string) => {
  // Retrieve fee record
  // Create reverse transfer
  // Update fee status to 'refunded'
}
```

### 4. Alternative Fee Structures

If you want to charge per-transaction instead:

```typescript
// In payment intent creation
const paymentIntent = await stripe.paymentIntents.create({
  amount: 1000,
  currency: 'usd',
  application_fee_amount: 300, // $3 per transaction
  // ...
}, {
  stripeAccount: connectedAccountId
})
```

### 5. Reporting Dashboard

Create admin endpoint to view fee collection stats:

```typescript
// GET /admin/platform-fees?period=2025-01
// Returns: total collected, failure rate, top issues
```

---

## Troubleshooting

### Issue: "Transfer creation failed: Insufficient funds"

**Solution**:
- Verify connected account has available balance (not just pending)
- Check if payouts are scheduled/in-transit
- Consider reducing fee or implementing grace period

### Issue: "No permission to create transfers"

**Solution**:
- Verify connected account type (Express/Custom support platform-initiated transfers)
- Check account capabilities: `transfers` capability must be active

### Issue: Lambda timeout

**Solution**:
- Increase timeout in endpoint definition (currently 300s)
- Consider processing accounts in batches
- Use Step Functions for >1000 accounts

### Issue: Duplicate charges

**Solution**:
- Verify idempotency key format includes fee_period
- Check `checkExistingFee()` is querying correctly
- Review CloudWatch logs for retry behavior

---

## Future Enhancements

1. **Variable pricing**: Charge based on transaction volume or account tier
2. **Prorated fees**: Charge proportional amount for mid-month onboarding
3. **Bulk processing**: Use Step Functions for large-scale processing
4. **Self-service fee management**: Allow sellers to view/dispute fees in dashboard
5. **Automated retries**: Retry failed collections after 7 days
6. **Analytics**: Track platform revenue trends over time

---

## References

- [Stripe Transfers API](https://stripe.com/docs/connect/charges-transfers)
- [Stripe Connect Platform Fees](https://stripe.com/docs/connect/charges#collecting-fees)
- [EventBridge Scheduled Events](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-rule-schedule.html)
- [Idempotent Requests](https://stripe.com/docs/api/idempotent_requests)

---

## Support

For questions or issues:
1. Check CloudWatch Logs: `/aws/lambda/marketplace-{env}-monthlyAccountFees`
2. Review DynamoDB records: `platform_fees` table
3. Check Stripe Dashboard: Transfers section
4. Contact: [Your platform support email]

---

**Document Version**: 1.0
**Last Updated**: 2025-01-15
**Estimated Implementation Time**: 4-6 hours
