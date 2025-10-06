import { Purchase } from '@marketplace/types'
import { purchasesTableName } from '@marketplace/constants'
import { query } from '../dynamo-helpers/query'

export const getAllPurchasesForCart = async (cartId: string): Promise<Purchase[]> => {
  try {
    const result = await query<Purchase>({
      tableName: purchasesTableName!,
      indexName: 'cart_id-index',
      keyConditionExpression: 'cart_id = :cart_id',
      expressionAttributeValues: {
        ':cart_id': cartId
      }
    })

    return result.items || []
  } catch (error) {
    console.error(`Failed to get purchases for cart ${cartId}:`, error)
    return []
  }
}