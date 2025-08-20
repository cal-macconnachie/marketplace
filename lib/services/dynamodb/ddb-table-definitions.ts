export interface DdbTableDefinition {
  tableName: string
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
  // Add other properties as needed
}

export const ddbTableDefinitions: DdbTableDefinition[] = [
  {
    tableName: 'users',
    partitionKey: { name: 'id', type: 'S' },
    billingMode: 'PAY_PER_REQUEST',
    globalSecondaryIndexes: [
      {
        indexName: 'email-index',
        partitionKey: { name: 'email', type: 'S' },
        sortKey: {
          name: 'id',
          type: 'S'
        },
        projectionType: 'ALL'
      },
      {
        indexName: 'cognito_id-index',
        partitionKey: { name: 'cognito_id', type: 'S' },
        projectionType: 'ALL'
      },
      {
        indexName: 'stripe_id-index',
        partitionKey: {
          name: 'stripe_id',
          type: 'S'
        },
        sortKey: {
          name: 'id',
          type: 'S'
        },
        projectionType: 'ALL'
      },
      {
        indexName: 'organization_id-index',
        partitionKey: {
          name: 'organization_id',
          type: 'S'
        },
        sortKey: {
          name: 'id',
          type: 'S'
        },
        projectionType: 'ALL'
      }
    ],
    stream: 'NEW_AND_OLD_IMAGES'
  },
  {
    tableName: 'products',
    partitionKey: {
      name: 'group_id',
      type: 'S'
    },
    sortKey: {
      name: 'id',
      type: 'S'
    },
    billingMode: 'PAY_PER_REQUEST',
    stream: 'NEW_AND_OLD_IMAGES' // Enable DynamoDB Streams for Lambda triggers
  },
  {
    tableName: 'payment-methods',
    partitionKey: {
      name: 'user_id',
      type: 'S'
    },
    sortKey: {
      name: 'id',
      type: 'S'
    },
    billingMode: 'PAY_PER_REQUEST'
  },
  {
    tableName: 'promos',
    partitionKey: {
      name: 'type',
      type: 'S'
    },
    sortKey: {
      name: 'id',
      type: 'S'
    },
    billingMode: 'PAY_PER_REQUEST',
    stream: 'NEW_AND_OLD_IMAGES',
    globalSecondaryIndexes: [
      {
        indexName: 'code-index',
        partitionKey: {
          name: 'code',
          type: 'S'
        },
        projectionType: 'ALL'
      }
    ]
  },
  {
    tableName: 'organizations',
    partitionKey: {
      name: 'id',
      type: 'S'
    },
    billingMode: 'PAY_PER_REQUEST',
    stream: 'NEW_AND_OLD_IMAGES'
  }
]
