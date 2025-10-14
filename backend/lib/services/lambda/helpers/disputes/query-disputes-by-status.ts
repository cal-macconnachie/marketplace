import { disputesTableName } from '@marketplace/constants'
import { Dispute } from '@marketplace/types'
import { query } from '../dynamo-helpers/query'

/**
 * Query disputes by status (for platform manager view)
 */
export async function queryDisputesByStatus(params: {
  status: Dispute['status']
  limit?: number
  lastKey?: Record<string, unknown>
}): Promise<{
  items: Dispute[]
  lastKey?: Record<string, unknown>
}> {
  const {
    status, limit = 20, lastKey 
  } = params

  const result = await query<Dispute>({
    tableName: disputesTableName!,
    indexName: 'status-created-index',
    keyConditionExpression: '#status = :status',
    expressionAttributeNames: {
      '#status': 'status'
    },
    expressionAttributeValues: {
      ':status': status
    },
    limit,
    exclusiveStartKey: lastKey,
    sortOrder: 'DESC'
  })

  return {
    items: result.items || [],
    lastKey: result.lastEvaluatedKey
  }
}
