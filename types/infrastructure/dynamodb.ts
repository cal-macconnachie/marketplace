/**
 * DynamoDB table definitions and configuration types
 * Used by CDK stacks to define and create DynamoDB tables
 */

export type TableName =
  'users' |
  'products' |
  'payment-methods' |
  'promos' | 
  'organizations' |
  'purchases' |
  'tax-calculations' |
  'rate-limits' |
  'one-time-codes' |
  'purchase-carts' |
  'purchased-products' |
  'notifications' |
  'disputes'

export interface DdbTableDefinition {
  tableName: TableName
  partitionKey: { name: string; type: 'S' | 'N' | 'B' }
  sortKey?: { name: string; type: 'S' | 'N' | 'B' }
  billingMode?: 'PAY_PER_REQUEST' | 'PROVISIONED'
  globalSecondaryIndexes?: Array<{
    indexName: string
    partitionKey: { name: string; type: 'S' | 'N' | 'B' }
    sortKey?: { name: string; type: 'S' | 'N' | 'B' }
    projectionType?: 'ALL' | 'KEYS_ONLY' | 'INCLUDE'
    nonKeyAttributes?: string[]
  }>
  localSecondaryIndexes?: Array<{
    indexName: string
    sortKey: { name: string; type: 'S' | 'N' | 'B' }
    projectionType?: 'ALL' | 'KEYS_ONLY' | 'INCLUDE'
    nonKeyAttributes?: string[]
  }>
  ttlAttribute?: string // Optional TTL attribute for the table
  stream?: 'NEW_IMAGE' | 'OLD_IMAGE' | 'NEW_AND_OLD_IMAGES' | 'KEYS_ONLY' // Optional DynamoDB stream view type
}
