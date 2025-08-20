import { query } from "../dynamo-helpers/query"

export interface PromoLookupResult {
  id: string
  type: 'coupon' | 'promotion_code'
  code?: string
  active?: boolean
  stripeId?: string
}

export async function getPromoByCode(code: string): Promise<PromoLookupResult | null> {
  if (!process.env.PROMOS_TABLE) {
    throw new Error('PROMOS_TABLE environment variable is not set')
  }

  const result = await query<PromoLookupResult>({
    tableName: process.env.PROMOS_TABLE,
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