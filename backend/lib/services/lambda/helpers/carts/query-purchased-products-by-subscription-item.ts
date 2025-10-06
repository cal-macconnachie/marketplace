import { PurchasedProduct } from '@marketplace/types'
import { purchasedProductsTableName } from '@marketplace/constants'
import { queryAll } from '../dynamo-helpers/query'

export const queryPurchasedProductsBySubscriptionItem = async ({
  subscriptionItemId
}: {
  subscriptionItemId: string
}): Promise<PurchasedProduct[]> => {
  const result = await queryAll<PurchasedProduct>({
    tableName: purchasedProductsTableName!,
    indexName: 'subscription_item_id-index',
    keyConditionExpression: '#subscription_item_id = :subscription_item_id',
    expressionAttributeNames: {
      '#subscription_item_id': 'subscription_item_id'
    },
    expressionAttributeValues: {
      ':subscription_item_id': subscriptionItemId
    }
  })
  return result
}
