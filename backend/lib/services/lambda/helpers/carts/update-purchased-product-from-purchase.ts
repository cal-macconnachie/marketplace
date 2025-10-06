import Stripe from 'stripe'
import { PurchasedProduct } from '../../handlers/products'
import { Purchase } from '../../handlers/purchases'
import { update } from '../dynamo-helpers/update'

export const updatePurchasedProductFromPurchase = async ({
  existingPurchasedProduct,
  purchase,
  subscriptionItem
}: {
  existingPurchasedProduct: PurchasedProduct
  purchase: Purchase
  subscriptionItem: Stripe.SubscriptionItem
}): Promise<PurchasedProduct> => {
  const updatedPurchasedProduct = await update<PurchasedProduct>({
    tableName: process.env.PURCHASED_PRODUCTS_TABLE!,
    key: {
      organization_id: existingPurchasedProduct.organization_id,
      id: existingPurchasedProduct.id
    },
    updates: {
      purchase_id: purchase.id,
      amount: purchase.amount,
      in_good_standing_until: subscriptionItem.current_period_end,
      updated_at: new Date().toISOString()
    },
    returnUpdated: true
  })
  return updatedPurchasedProduct
}
