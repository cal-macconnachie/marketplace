import { disputesTableName } from '@marketplace/constants'
import { Dispute } from '@marketplace/types'
import { query } from '../dynamo-helpers/query'

/**
 * Query disputes for a seller organization
 */
export async function queryDisputesBySeller(params: {
  sellerOrganizationId: string
  status?: Dispute['status']
  limit?: number
  lastKey?: Record<string, unknown>
}): Promise<{
  items: Dispute[]
  lastKey?: Record<string, unknown>
}> {
  const {
    sellerOrganizationId, status, limit = 20, lastKey 
  } = params

  const result = await query<Dispute>({
    tableName: disputesTableName!,
    indexName: 'seller_organization_id-index',
    keyConditionExpression: 'seller_organization_id = :seller_org_id',
    expressionAttributeValues: {
      ':seller_org_id': sellerOrganizationId,
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
