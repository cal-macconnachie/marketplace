import { disputesTableName } from '@marketplace/constants'
import { Dispute } from '@marketplace/types'
import { query } from '../dynamo-helpers/query'

/**
 * Query disputes for a buyer user
 */
export async function queryDisputesByBuyer(params: {
  buyerUserId: string
  status?: Dispute['status']
  limit?: number
  lastKey?: Record<string, unknown>
}): Promise<{
  items: Dispute[]
  lastKey?: Record<string, unknown>
}> {
  const {
    buyerUserId, status, limit = 20, lastKey 
  } = params

  const result = await query<Dispute>({
    tableName: disputesTableName!,
    indexName: 'buyer_user_id-index',
    keyConditionExpression: 'buyer_user_id = :buyer_user_id',
    expressionAttributeValues: {
      ':buyer_user_id': buyerUserId,
      ...(status ? { ':status': status } : {})
    },
    ...(status ? {
      filterExpression: '#status = :status',
      expressionAttributeNames: {
        '#status': 'status'
      }
    } : {}),
    limit,
    exclusiveStartKey: lastKey,
    sortOrder: 'DESC'
  })

  return {
    items: result.items || [],
    lastKey: result.lastEvaluatedKey
  }
}
