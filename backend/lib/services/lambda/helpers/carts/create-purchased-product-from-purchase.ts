import Stripe from 'stripe'
import { PurchasedProduct } from '../../handlers/products'
import { Purchase } from '../../handlers/purchases'
import { get } from '../dynamo-helpers/get'
import { v4 } from 'uuid'

export const createPurchasedProductFromPurchase = async ({
  purchaseKey,
  subscriptionItem
}: {
  purchaseKey: {
    userId: string
    purchaseId: string
  }
  subscriptionItem?: Stripe.SubscriptionItem
}): Promise<PurchasedProduct> => {
  const purchase = await get<Purchase>({
    tableName: process.env.PURCHASES_TABLE!,
    key: {
      id: purchaseKey.purchaseId,
      user_id: purchaseKey.userId
    }
  })
  if (!purchase) {
    throw new Error(`Purchase not found: ${purchaseKey.purchaseId}`)
  }
  const purchasedProduct: PurchasedProduct = {
    id: v4(),
    product_id: purchase.product_id,
    group_id: purchase.product_group_id,
    name: purchase.product_name,
    amount: purchase.amount,
    currency: purchase.currency,
    purchase_id: purchase.id,
    subscription_id: subscriptionItem?.subscription,
    subscription_item_id: subscriptionItem?.id,
    in_good_standing_until: subscriptionItem?.current_period_end,
    organization_id: purchase.organization_id,
    user_id: purchase.user_id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  return purchasedProduct
}
