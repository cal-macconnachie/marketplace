import { Purchase } from '../handlers/purchases'
import { Product } from '../handlers/products'
import { create } from './dynamo-helpers/create'
import { atomicUpdate } from './dynamo-helpers/atomic-update'

export async function addPurchase(purchase: Omit<Purchase, 'status'>, product?: Product): Promise<Purchase> {
  let finalPurchase: Purchase = {
    ...purchase,
    status: 'pending'
  }

  // If seller_organization_id is not provided and we have a product, get it from the product
  if (!purchase.seller_organization_id && product?.organization_id) {
    finalPurchase = {
      ...finalPurchase,
      seller_organization_id: product.organization_id
    }
  }

  finalPurchase = await create<Purchase>({
    tableName: process.env.PURCHASES_TABLE!,
    key: {
      user_id: finalPurchase.user_id,
      id: finalPurchase.id
    },
    record: finalPurchase,
    returnCreated: true
  })
  // add purchase to cart purchases array using atomic updates
  if (finalPurchase.cart_id) {
    await atomicUpdate({
      tableName: process.env.PURCHASE_CARTS_TABLE!,
      key: {
        user_id: finalPurchase.user_id,
        id: finalPurchase.cart_id
      },
      updateExpression: 'SET purchases = list_append(if_not_exists(purchases, :empty_list), :purchase)',
      expressionAttributeValues: {
        ':purchase': [finalPurchase.id],
        ':empty_list': []
      }
    })
  }
  return finalPurchase
}