import { PurchasedProduct } from '@marketplace/types'
import { purchasedProductsTableName } from '@marketplace/constants'
import { query } from '../dynamo-helpers/query'
import { update } from '../dynamo-helpers/update'

export const updatePurchasedProductAmount = async ({
  purchaseId,
  amount
}: {
  purchaseId: string
  amount: number
}) => {
  const { items: purchasedProducts } = await query<PurchasedProduct>({
    tableName: purchasedProductsTableName!,
    indexName: 'purchase_id-index',
    keyConditionExpression: 'purchase_id = :purchase_id',
    expressionAttributeValues: {
      ':purchase_id': purchaseId
    },
    limit: 1
  })
  if (purchasedProducts.length === 0) {
    throw new Error(`No purchased product found for purchase ID ${purchaseId}`)
  }
  const purchasedProduct = purchasedProducts[0]
  await update({
    tableName: purchasedProductsTableName!,
    key: {
      organization_id: purchasedProduct.organization_id,
      id: purchasedProduct.id
    },
    updates: {
      amount,
      updated_at: new Date().toISOString()
    }
  })
}
