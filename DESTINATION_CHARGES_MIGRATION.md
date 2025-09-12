# Migration to Destination Charges Architecture

## Current Architecture Analysis

### Problems with Current Setup
Your architecture was built assuming customers and payment methods could be shared across connected accounts, but Stripe Connect **does not support automatic sharing**. Currently:

- **Direct charges** are created on connected accounts (`stripeAccount: product.account_id`)
- **Customer exists only on platform account** (created in `guest-checkout.ts:258-284`)
- **Payment methods attached to platform customer** (created in `guest-checkout.ts:350-365`)
- **Products managed per connected account** (DynamoDB stream handler with `account_id`)

This creates a **fundamental mismatch**: platform customers can't directly purchase from connected account products.

### Current Connected Account Integration
Your codebase already supports connected accounts through:
- Products have `account_id` field linking to Stripe connected accounts
- All Stripe API calls use `stripeAccount` parameter 
- DynamoDB stream handler syncs products to specific connected accounts
- Subscription management groups products by `account_id`

## Destination Charges Solution

### Architecture Overview
**Destination charges** solve the sharing problem by:
1. **Platform processes all payments** (using platform customer/payment method)
2. **Funds automatically transferred** to connected accounts
3. **Connected accounts retain product autonomy**
4. **No need to clone customers/payment methods**

### Key Benefits
- ✅ **Solves sharing problem**: One customer on platform, no cloning needed
- ✅ **Minimal code changes**: Swap direct charges for destination charges  
- ✅ **Connected account autonomy preserved**: They still manage products/taxes
- ✅ **Simplified architecture**: No complex customer/payment method syncing
- ✅ **Consistent with current patterns**: Already using `stripeAccount` parameter

## Implementation Plan

### Phase 1: Update Payment Processing

#### 1.0 Dual EventBridge Configuration Setup

**CRITICAL ARCHITECTURAL REQUIREMENT**

Stripe's EventBridge integration can only listen to **one account type** (either platform OR connected accounts, not both). Current setup handles connected account events only.

**Current EventBridge (Connected Accounts):**
- `account.updated` - Connected account onboarding status
- `invoice.paid`/`invoice.payment_failed` - Connected account invoices

**Required: New Platform EventBridge Configuration**
- `payment_intent.succeeded` - Destination charge completions  
- `transfer.created` - Fund transfers to connected accounts
- `application_fee.created` - Platform fee collection
- `charge.dispute.created` - Chargeback handling (platform responsibility)

**Implementation Steps:**

1. **Create Platform Event Handler**
```typescript
// lib/services/lambda/handlers/stripe-platform-event-handler.ts
export const stripePlatformEventHandler = async (event: EventBridgeEvent<'Stripe Event', Stripe.Event>) => {
  const type = event.detail.type
  switch (type) {
    case 'payment_intent.succeeded':
      // Handle successful destination charges
      // Update purchase records with platform payment details
      break
    case 'transfer.created':
      // Track fund transfers to connected accounts  
      // Update purchase records with transfer_id
      break
    case 'application_fee.created':
      // Record platform revenue and fee collection
      break
    case 'charge.dispute.created':
      // Handle chargebacks (platform responsibility with destination charges)
      break
  }
}
```

2. **Update Lambda Endpoint Definitions**
Add platform event handler to `lambda-endpoint-definitions.ts`

3. **CDK EventBridge Configuration**  
Configure two separate EventBridge rules:
- Existing: Connected account events → `stripe-event-handler.ts`
- New: Platform account events → `stripe-platform-event-handler.ts`

#### 1.1 Modify One-Time Payments (`one-time-payment.ts`)

**Current Pattern:**
```typescript
// Direct charge on connected account
const paymentIntent = await stripe.paymentIntents.create({
  amount: finalAmount,
  currency: product.default_price_data.currency,
  customer: customerId, // Platform customer ID
  // ... other params
}, {
  stripeAccount: product.account_id // DIRECT CHARGE
})
```

**New Destination Charge Pattern:**
```typescript
// Destination charge from platform to connected account
const paymentIntent = await stripe.paymentIntents.create({
  amount: finalAmount,
  currency: product.default_price_data.currency,
  customer: customerId, // Platform customer ID
  payment_method: paymentMethodId, // Platform payment method
  transfer_data: {
    destination: product.account_id, // Connected account receives funds
    amount: calculateConnectedAccountAmount(finalAmount, platformFeeAmount)
  },
  application_fee_amount: platformFeeAmount, // Your platform fee
  on_behalf_of: product.account_id, // Makes connected account settlement merchant
  // ... other params
  // NO stripeAccount parameter - charge created on platform
})
```

#### 1.2 Modify Subscription Management (`manage-subscription.ts`)

**Key Changes:**
- Remove `stripeAccount` from subscription creation
- Add `transfer_data` and `application_fee` to subscription items
- Use `on_behalf_of` for tax liability
- Platform creates subscription, funds transfer to connected accounts

#### 1.3 Platform Fee Configuration

Add new fee calculation logic:
```typescript
// New helper function needed
export const calculatePlatformFee = (
  amount: number, 
  connectedAccountId: string, 
  productType: 'one_time' | 'subscription'
): number => {
  // Your platform fee logic (e.g., 3% + $0.30)
  const percentageFee = Math.round(amount * 0.03)
  const fixedFee = 30 // $0.30 in cents
  return percentageFee + fixedFee
}
```

### Phase 2: Update Product Management

#### 2.1 Product Creation Flow
**No changes needed** - products still created on connected accounts via DynamoDB stream handler

#### 2.2 Product Querying for Checkout
Connected accounts maintain product catalogs, platform queries them during checkout:
```typescript
// In guest-checkout.ts or purchase flow
const getConnectedAccountProducts = async (productKeys: {id: string, group_id: string}[]) => {
  // Group by connected account
  const productsByAccount = await groupProductsByAccount(productKeys)
  
  // Query each connected account for their products
  const allProducts = []
  for (const [accountId, productIds] of Object.entries(productsByAccount)) {
    const products = await Promise.all(
      productIds.map(id => 
        stripe.products.retrieve(id, { stripeAccount: accountId })
      )
    )
    allProducts.push(...products)
  }
  return allProducts
}
```

### Phase 3: Update Database Schema

#### 3.1 Organization Model Updates
```typescript
// Add platform fee tracking
interface Organization {
  // ... existing fields
  platform_fee_percentage?: number // Custom fee per organization
  destination_charges_enabled: boolean // Feature flag
}
```

#### 3.2 Purchase Tracking Updates  
```typescript
// Track destination charge details
interface Purchase {
  // ... existing fields
  platform_fee_amount?: number
  connected_account_id?: string
  destination_charge_id?: string // Payment intent ID
  transfer_id?: string // Stripe transfer ID
}
```

### Phase 4: Tax Handling

#### 4.1 Tax Responsibility
With destination charges + `on_behalf_of`:
- **Connected account** becomes settlement merchant
- **Connected account** handles tax calculation and collection
- **Platform** not responsible for tax compliance per transaction

#### 4.2 Implementation
```typescript
// In payment creation
const paymentIntent = await stripe.paymentIntents.create({
  // ... other params
  on_behalf_of: product.account_id, // Connected account handles taxes
  // Stripe Tax will use connected account's tax settings
})
```

### Phase 5: Migration Strategy

#### 5.1 Feature Flag Approach
```typescript
// Environment variable or database flag
const USE_DESTINATION_CHARGES = process.env.DESTINATION_CHARGES_ENABLED === 'true'

// In payment processing
if (USE_DESTINATION_CHARGES) {
  return createDestinationCharge(params)
} else {
  return createDirectCharge(params) // Current implementation
}
```

#### 5.2 Gradual Migration
1. **Deploy destination charges code** with feature flag OFF
2. **Test with specific organizations** by enabling flag per org
3. **Monitor payment flows** and connected account transfers
4. **Enable globally** once confident
5. **Remove direct charges code** after successful migration

### Phase 6: Connected Account Onboarding

#### 6.1 Account Requirements
Connected accounts need:
- **Standard or Express accounts** (Custom accounts have limitations)
- **Completed onboarding** for receiving transfers
- **Capabilities enabled**: `card_payments`, `transfers`

#### 6.2 Validation Before Payment
```typescript
const validateConnectedAccount = async (accountId: string) => {
  const account = await stripe.accounts.retrieve(accountId)
  
  if (!account.charges_enabled || !account.transfers_enabled) {
    throw new Error(`Connected account ${accountId} not ready for destination charges`)
  }
  
  return account
}
```

## Risk Assessment

### Low Risk Changes
- ✅ **Product management unchanged** - connected accounts keep full control
- ✅ **Database schema minimal changes** - mostly additive fields
- ✅ **API endpoints unchanged** - same customer-facing interface

### Medium Risk Changes  
- ⚠️ **Payment flow modifications** - core business logic changes
- ⚠️ **Tax liability shift** - from platform to connected accounts
- ⚠️ **Fee calculation logic** - new platform fee handling

### High Risk Considerations
- 🚨 **Dual EventBridge architecture** - critical infrastructure change required
- 🚨 **Subscription billing complexity** - multiple connected accounts per subscription
- 🚨 **Refund handling** - need to handle connected account refunds
- 🚨 **Dispute management** - platform responsible for chargebacks initially

## Testing Strategy

### 1. Unit Testing
- Payment creation with destination charges
- Fee calculation accuracy
- Connected account validation
- Tax calculation delegation

### 2. Integration Testing
- End-to-end checkout flow
- Multi-account subscription management
- Refund and dispute flows
- Connected account onboarding

### 3. Production Testing
- Feature flag with subset of users
- Monitor Stripe dashboard for transfers
- Validate connected account fund receipt
- Check tax calculation accuracy

## Monitoring and Observability

### Key Metrics
- **Transfer success rate** to connected accounts
- **Platform fee collection** accuracy  
- **Payment failure reasons** (connected account issues)
- **Tax calculation** delegation success

### Alerting
- Failed transfers to connected accounts
- Connected account capability issues
- Unusual fee calculation patterns
- Tax compliance problems