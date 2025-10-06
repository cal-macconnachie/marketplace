import type { PromoLookupResult } from '@marketplace/types'
import { promosTableName } from '@marketplace/constants'
import { query } from "../dynamo-helpers/query"

export async function getPromoByCode(code: string): Promise<PromoLookupResult | null> {
  if (!promosTableName) {
    throw new Error('PROMOS_TABLE environment variable is not set')
  }

  const result = await query<PromoLookupResult>({
    tableName: promosTableName,
    indexName: 'code-index',
    keyConditionExpression: '#code = :code',
    expressionAttributeNames: {
      '#code': 'code'
    },
    expressionAttributeValues: {
      ':code': code
    },
    limit: 1
  })

  return result.items.length > 0 ? result.items[0] : null
}