import { Purchase } from '../handlers/purchases'
import { Product } from '../handlers/products'
import {
  create, createTransaction 
} from './dynamo-helpers/create'
import { atomicUpdate } from './dynamo-helpers/atomic-update'
import { TransactWriteItem } from '@aws-sdk/client-dynamodb'
import { updateTransaction } from './dynamo-helpers/update'
import { transactWrite } from './dynamo-helpers/transact-write'

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

export async function setCartPurchases({
  purchases
}: {
  purchases: Purchase[]
}) {
  const userId = purchases[0].user_id
  const cartId = purchases[0].cart_id
  if (!purchases.every((p) => p.user_id === userId) || userId == null) {
    throw new Error('All purchases must belong to the same user')
  }
  if (!purchases.every((p) => p.cart_id === cartId) || cartId == null) {
    throw new Error('All purchases must belong to the same cart')
  }
  const transactions: TransactWriteItem[] = []
  for (const purchase of purchases) {
    const newPurchase: Purchase = {
      ...purchase,
      status: 'pending'
    }
    transactions.push(createTransaction({
      tableName: process.env.PURCHASES_TABLE!,
      record: newPurchase
    }))
  }
  transactions.push(updateTransaction({
    tableName: process.env.PURCHASE_CARTS_TABLE!,
    key: {
      user_id: userId,
      id: cartId
    },
    updates: {
      purchases: purchases.reduce((acc: { [purchaseId: string]: 'pending' }, purchase) => {
        acc[purchase.id] = 'pending'
        return acc
      }, {})
    }
  }))
  await transactWrite({ items: transactions })
}