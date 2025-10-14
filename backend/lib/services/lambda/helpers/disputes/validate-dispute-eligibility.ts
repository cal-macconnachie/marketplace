import { purchasesTableName } from '@marketplace/constants'
import { Purchase } from '@marketplace/types'
import { batchGet } from '../dynamo-helpers/batch-get'

/**
 * Validates if purchases can be disputed
 * @throws Error if validation fails
 */
export async function validateDisputeEligibility(params: {
  purchaseIds: string[]
  userId: string
}): Promise<{
  purchases: Purchase[]
  totalAmount: number
  currency: string
  cartId: string
  sellerOrganizationId: string
}> {
  const {
    purchaseIds, userId 
  } = params

  if (purchaseIds.length === 0) {
    throw new Error('At least one purchase must be selected for dispute')
  }

  // Fetch all purchases
  const purchases = await batchGet<Purchase>({
    tableName: purchasesTableName!,
    keys: purchaseIds.map(id => ({
      user_id: userId, id 
    }))
  })

  if (purchases.length !== purchaseIds.length) {
    throw new Error('One or more purchases not found')
  }

  // Validation checks
  const cartIds = new Set(purchases.map(p => p.cart_id).filter(Boolean))
  if (cartIds.size !== 1) {
    throw new Error('All purchases must be from the same cart')
  }

  const cartId = Array.from(cartIds)[0]
  if (!cartId) {
    throw new Error('Purchases must have a cart_id')
  }

  const sellerOrgs = new Set(purchases.map(p => p.seller_organization_id).filter(Boolean))
  if (sellerOrgs.size !== 1) {
    throw new Error('All purchases must be from the same seller organization')
  }

  const sellerOrganizationId = Array.from(sellerOrgs)[0]
  if (!sellerOrganizationId) {
    throw new Error('Purchases must have a seller_organization_id')
  }

  // Check purchase status and dispute eligibility
  for (const purchase of purchases) {
    // Check if already disputed
    if (purchase.disputed) {
      throw new Error(`Purchase ${purchase.id} has already been disputed`)
    }

    // Check status
    if (purchase.status === 'in_dispute') {
      throw new Error(`Purchase ${purchase.id} is already in dispute`)
    }

    if (purchase.status === 'refunded' || purchase.status === 'partially_refunded') {
      throw new Error(`Purchase ${purchase.id} has already been refunded`)
    }

    if (purchase.status === 'pending' || purchase.status === 'failed') {
      throw new Error(`Only completed purchases can be disputed. Purchase ${purchase.id} is ${purchase.status}`)
    }

    // Check ownership
    if (purchase.user_id !== userId) {
      throw new Error(`Purchase ${purchase.id} does not belong to this user`)
    }
  }

  // Calculate total amount and verify currency consistency
  const currencies = new Set(purchases.map(p => p.currency))
  if (currencies.size !== 1) {
    throw new Error('All purchases must have the same currency')
  }

  const currency = Array.from(currencies)[0]
  const totalAmount = purchases.reduce((sum, p) => sum + p.amount, 0)

  return {
    purchases,
    totalAmount,
    currency,
    cartId,
    sellerOrganizationId
  }
}
