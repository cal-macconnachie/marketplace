# Grouped Destination Charges (Simplified Plan)

## Overview

We will stop creating a PaymentIntent per product. The one‑time purchase helper will only compute and return a purchase record (with base/tax/total and necessary metadata) without calling Stripe. A later step will group these returned purchase records by `account_id` and `currency`, then create and confirm one destination charge (PaymentIntent) per group.

This keeps destination charges while drastically simplifying the flow and reducing Stripe calls.

## What Changes

- Extract Stripe `paymentIntents.create` and `paymentIntents.confirm` out of `lib/services/lambda/helpers/stripe/one-time-payment.ts`.
- The one‑time helper returns a purchase record for each product (no charge performed).
- A new grouping/charging step:
  - Groups purchase records by `(connected account_id, currency)`.
  - Sums amounts (base and tax) per group.
  - Creates and confirms a single PaymentIntent per group using destination charges (`transfer_data.destination`, `on_behalf_of`).
  - Assigns the resulting `payment_intent_id` (aka charge id) back to all purchases in that group.

Subscriptions: unchanged.

## Minimal Flow

1. Build purchases (no charging):
   - For each one‑time product, compute discount, tax, base, total using current logic.
   - Return a purchase record with: `product_id`, `connected_account_id`, `currency`, `base_amount`, `tax_amount`, `total_amount`, and any metadata needed for receipts.
   - Do not call Stripe here; optionally persist as `pending` or return in‑memory to the caller.

2. Group and charge:
   - Group returned purchases by `(connected_account_id, currency)`.
   - For each group:
     - `sum_base = Σ(base_amount)`, `sum_tax = Σ(tax_amount)`, `total = sum_base + sum_tax`.
     - Compute `application_fee_amount` on `sum_base` using existing policy.
     - Create a PaymentIntent with `amount = total`, `currency`, `transfer_data.destination = connected_account_id`, `on_behalf_of = connected_account_id`.
     - Confirm the PaymentIntent.
     - On success, set `destination_charge_id = payment_intent_id` on all purchases in the group and mark them as paid; update org `purchased_products` accordingly.

## Interfaces (Sketch)

- one‑time purchase helper (updated):
  - Input: `{ product, user, organization, paymentMethodId?, promoCode?, couponId?, taxCode?, ipAddress? }`
  - Output: `{ purchase: PurchaseLike }` (no PI created)

- grouping/charging step (new):
  - Input: `PurchaseLike[]`
  - Output: `{ paymentIntentId, groupedPurchases: PurchaseLike[] }[]`

Where `PurchaseLike` includes at minimum: `product_id`, `connected_account_id`, `currency`, `base_amount`, `tax_amount`, `total_amount`, `user_id`, `organization_id`.

## Idempotency (Lightweight)

- Use an idempotency key per group based on `(request_id|cart_id, account_id, currency)` when creating the PaymentIntent.
- Configure Stripe client retries (`maxNetworkRetries`) to handle transient 5xx/429s.

## Data Persistence

- Option A (simplest): only persist after charge success. Build purchases in memory, charge groups, then write purchases with the shared `destination_charge_id`.
- Option B (more durability): persist purchases as `pending` before charging, then update to `paid` with `destination_charge_id` after success.

Either way, avoid lost updates when updating `organization.purchased_products` (use transactional write or derive from `purchases`).

## Migration Steps

1. In `one-time-payment.ts`, remove PI create/confirm and return the computed purchase object without charging.
2. In the caller (`purchase-products.ts`), collect all returned purchases from one‑time items.
3. Group purchases by `(connected_account_id, currency)` and perform PaymentIntent create/confirm per group.
4. On success, attach the resulting `payment_intent_id` to each purchase in the group and persist purchases; update org state.
5. Keep subscription logic as is.

## Testing

- Single account + currency: multiple products produce one PI; all purchases share the PI id.
- Multiple accounts: one PI per account; purchases tagged accordingly.
- Retry with same request/cart id: no duplicate charges (idempotency key).

## References

- Destination charges: https://stripe.com/docs/connect/destination-charges
- Idempotency: https://stripe.com/docs/idempotency
