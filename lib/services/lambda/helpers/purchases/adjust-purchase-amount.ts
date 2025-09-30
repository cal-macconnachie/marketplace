import { Purchase } from '../../handlers/purchases'
import { update } from '../dynamo-helpers/update'

interface AdjustPurchaseAmountParams {
  purchase: Purchase
  correctAmount: number
}

/**
 * Adjusts a purchase's amount fields to match a correct total amount.
 * Maintains the tax ratio from the original purchase when recalculating.
 */
export const adjustPurchaseAmount = async ({
  purchase,
  correctAmount
}: AdjustPurchaseAmountParams): Promise<Purchase> => {
  // Calculate the original tax rate
  const originalTotal = purchase.amount
  const originalBaseAmount = purchase.base_amount ?? (purchase.amount - (purchase.tax_amount ?? 0))
  const originalTaxAmount = purchase.tax_amount ?? 0
  const originalPlatformFeeAmount = purchase.platform_fee_amount ?? 0
  const originalTaxRate = originalTotal > 0 ? originalTaxAmount / originalTotal : 0

  console.log('[adjustPurchaseAmount] Inputs:', {
    purchaseId: purchase.id,
    correctAmount,
    originalTotal,
    originalTaxAmount,
    originalTaxRate
  })

  // Calculate new tax and base amounts maintaining the same tax ratio
  const newTaxAmount = Math.round(correctAmount * originalTaxRate)
  const newBaseAmount = correctAmount - newTaxAmount

  console.log('[adjustPurchaseAmount] Calculated:', {
    newTaxAmount,
    newBaseAmount
  })

  // Update the purchase record
  const updatedPurchase = await update<Purchase>({
    tableName: process.env.PURCHASES_TABLE!,
    key: {
      user_id: purchase.user_id,
      id: purchase.id
    },
    updates: {
      amount: correctAmount,
      original_amount: purchase.original_amount ?? originalTotal,
      base_amount: newBaseAmount,
      original_base_amount: purchase.original_base_amount ?? originalBaseAmount,
      tax_amount: newTaxAmount,
      original_tax_amount: originalTaxAmount,
      platform_fee_amount: originalPlatformFeeAmount > 0 ? Math.round(correctAmount * (originalPlatformFeeAmount / originalTotal)) : undefined,
      original_platform_fee_amount: originalPlatformFeeAmount
    },
    returnUpdated: true
  })

  return updatedPurchase
}