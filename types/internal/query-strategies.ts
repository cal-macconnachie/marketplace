import type { Purchase } from '../entities/payment'

/**
 * Query strategy for DynamoDB operations
 * @internal Backend only
 */
export interface QueryStrategy {
  type: 'get' | 'query' | 'none'
  keyConditionExpression?: string
  expressionAttributeValues?: Record<string, unknown>
  indexName?: string
  canSort?: boolean
}

/**
 * Input for purchases CRUD operations
 * @internal Backend only
 */
export interface PurchasesInput {
  purchase: Partial<Purchase>
  type?: 'create' | 'update' | 'read'
  lastEvaluatedKey?: Record<string, unknown>
  limit?: number
  sortOrder?: 'ASC' | 'DESC'
  sortBy?: 'purchased_at' | 'id'
}
