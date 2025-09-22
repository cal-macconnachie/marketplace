import { Purchase } from '../handlers/purchases'
import { Product } from '../handlers/products'
import { create } from './dynamo-helpers/create'

export async function addPurchase(purchase: Purchase, product?: Product): Promise<Purchase> {
  let finalPurchase = purchase

  // If seller_organization_id is not provided and we have a product, get it from the product
  if (!purchase.seller_organization_id && product?.organization_id) {
    finalPurchase = {
      ...purchase,
      seller_organization_id: product.organization_id
    }
  }

  return await create<Purchase>({
    tableName: process.env.PURCHASES_TABLE!,
    key: {
      user_id: finalPurchase.user_id,
      id: finalPurchase.id
    },
    record: finalPurchase,
    returnCreated: true
  })
}