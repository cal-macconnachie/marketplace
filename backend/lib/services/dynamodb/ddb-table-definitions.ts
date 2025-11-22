import { DdbTableDefinition } from '@marketplace/types'

// Constrain table definitions to only use valid TableNames from constants
export const ddbTableDefinitions: Array<DdbTableDefinition> = [
  {
    tableName: 'users',
    partitionKey: {
      name: 'id', type: 'S' 
    },
    billingMode: 'PAY_PER_REQUEST',
    globalSecondaryIndexes: [
      {
        indexName: 'email-index',
        partitionKey: {
          name: 'email', type: 'S' 
        },
        sortKey: {
          name: 'id',
          type: 'S'
        },
        projectionType: 'ALL'
      },
      {
        indexName: 'cognito_id-index',
        partitionKey: {
          name: 'cognito_id', type: 'S' 
        },
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
    globalSecondaryIndexes: [
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
    ]
  },
  {
    tableName: 'organizations',
    partitionKey: {
      name: 'id',
      type: 'S'
    },
    globalSecondaryIndexes: [
      {
        indexName: 'stripe_account_id-index',
        partitionKey: {
          name: 'stripe_account_id',
          type: 'S'
        },
        projectionType: 'ALL'
      }
    ],
    billingMode: 'PAY_PER_REQUEST',
    stream: 'NEW_AND_OLD_IMAGES'
  },
  {
    tableName: 'purchases',
    partitionKey: {
      name: 'user_id',
      type: 'S'
    },
    sortKey: {
      name: 'id',
      type: 'S'
    },
    globalSecondaryIndexes: [
      {
        indexName: 'payment_method_id-index',
        partitionKey: {
          name: 'payment_method_id',
          type: 'S'
        },
        sortKey: {
          name: 'purchased_at',
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
          name: 'purchased_at',
          type: 'S'
        },
        projectionType: 'ALL'
      },
      {
        indexName: 'seller_organization_id-index',
        partitionKey: {
          name: 'seller_organization_id',
          type: 'S'
        },
        sortKey: {
          name: 'purchased_at',
          type: 'S'
        },
        projectionType: 'ALL'
      },
      {
        indexName: 'cart_id-index',
        partitionKey: {
          name: 'cart_id',
          type: 'S'
        },
        sortKey: {
          name: 'purchased_at',
          type: 'S'
        },
        projectionType: 'ALL'
      }
    ],
    billingMode: 'PAY_PER_REQUEST',
    stream: 'NEW_AND_OLD_IMAGES'
  },
  {
    tableName: 'tax-calculations',
    partitionKey: {
      name: 'location',
      type: 'S'
    },
    sortKey: {
      name: 'tax_code',
      type: 'S'
    },
    billingMode: 'PAY_PER_REQUEST',
    ttlAttribute: 'expires_at'
  },
  {
    tableName: 'rate-limits',
    partitionKey: {
      name: 'key',
      type: 'S'
    },
    billingMode: 'PAY_PER_REQUEST',
    ttlAttribute: 'expires_at'
  },
  {
    tableName: 'one-time-codes',
    partitionKey: {
      name: 'email',
      type: 'S'
    },
    sortKey: {
      name: 'type',
      type: 'S'
    },
    billingMode: 'PAY_PER_REQUEST',
    ttlAttribute: 'expires_at'
  },
  {
    tableName: 'purchase-carts',
    partitionKey: {
      name: 'user_id',
      type: 'S'
    },
    sortKey: {
      name: 'id',
      type: 'S'
    },
    billingMode: 'PAY_PER_REQUEST',
    stream: 'NEW_AND_OLD_IMAGES'
  },
  {
    tableName: 'purchased-products',
    partitionKey: {
      name: 'organization_id',
      type: 'S'
    },
    sortKey: {
      name: 'id',
      type: 'S'
    },
    globalSecondaryIndexes: [
      {
        indexName: 'purchase_id-index',
        partitionKey: {
          name: 'purchase_id',
          type: 'S'
        },
        sortKey: {
          name: 'id',
          type: 'S'
        },
        projectionType: 'ALL'
      },
      {
        indexName: 'user_id-index',
        partitionKey: {
          name: 'user_id',
          type: 'S'
        },
        sortKey: {
          name: 'id',
          type: 'S'
        },
        projectionType: 'ALL'
      },
      {
        indexName: 'product_id-index',
        partitionKey: {
          name: 'product_id',
          type: 'S'
        },
        sortKey: {
          name: 'id',
          type: 'S'
        },
        projectionType: 'ALL'
      },
      {
        indexName: 'subscription_item_id-index',
        partitionKey: {
          name: 'subscription_item_id',
          type: 'S'
        },
        sortKey: {
          name: 'id',
          type: 'S'
        },
        projectionType: 'ALL'
      }
    ],
    billingMode: 'PAY_PER_REQUEST',
    stream: 'NEW_AND_OLD_IMAGES'
  },
  {
    tableName: 'notifications',
    partitionKey: {
      name: 'user_id',
      type: 'S'
    },
    sortKey: {
      name: 'id',
      type: 'S'
    },
    globalSecondaryIndexes: [
      {
        indexName: 'user-read-created-index',
        partitionKey: {
          name: 'user_id',
          type: 'S'
        },
        sortKey: {
          name: 'read_created_at',
          type: 'S'
        },
        projectionType: 'ALL'
      },
      {
        indexName: 'user-type-created-index',
        partitionKey: {
          name: 'user_id',
          type: 'S'
        },
        sortKey: {
          name: 'type_created_at',
          type: 'S'
        },
        projectionType: 'ALL'
      },
      {
        indexName: 'user-created-index',
        partitionKey: {
          name: 'user_id',
          type: 'S'
        },
        sortKey: {
          name: 'created_at',
          type: 'N'
        },
        projectionType: 'ALL'
      }
    ],
    billingMode: 'PAY_PER_REQUEST',
    stream: 'NEW_AND_OLD_IMAGES'
  },
  {
    tableName: 'disputes',
    partitionKey: {
      name: 'id',
      type: 'S'
    },
    sortKey: {
      name: 'created_at',
      type: 'S'
    },
    globalSecondaryIndexes: [
      {
        indexName: 'seller_organization_id-index',
        partitionKey: {
          name: 'seller_organization_id',
          type: 'S'
        },
        sortKey: {
          name: 'created_at',
          type: 'S'
        },
        projectionType: 'ALL'
      },
      {
        indexName: 'buyer_user_id-index',
        partitionKey: {
          name: 'buyer_user_id',
          type: 'S'
        },
        sortKey: {
          name: 'created_at',
          type: 'S'
        },
        projectionType: 'ALL'
      },
      {
        indexName: 'cart_id-index',
        partitionKey: {
          name: 'cart_id',
          type: 'S'
        },
        sortKey: {
          name: 'created_at',
          type: 'S'
        },
        projectionType: 'ALL'
      },
      {
        indexName: 'status-created-index',
        partitionKey: {
          name: 'status',
          type: 'S'
        },
        sortKey: {
          name: 'created_at',
          type: 'S'
        },
        projectionType: 'ALL'
      }
    ],
    billingMode: 'PAY_PER_REQUEST',
    stream: 'NEW_AND_OLD_IMAGES'
  },
  {
    tableName: 'platform-fees',
    partitionKey: {
      name: 'id',
      type: 'S'
    },
    sortKey: {
      name: 'created_at',
      type: 'S'
    },
    globalSecondaryIndexes: [
      {
        indexName: 'organization_id-index',
        partitionKey: {
          name: 'organization_id',
          type: 'S'
        },
        sortKey: {
          name: 'fee_period',
          type: 'S'
        },
        projectionType: 'ALL'
      },
      {
        indexName: 'fee_period-index',
        partitionKey: {
          name: 'fee_period',
          type: 'S'
        },
        sortKey: {
          name: 'created_at',
          type: 'S'
        },
        projectionType: 'ALL'
      },
      {
        indexName: 'status-index',
        partitionKey: {
          name: 'status',
          type: 'S'
        },
        sortKey: {
          name: 'created_at',
          type: 'S'
        },
        projectionType: 'ALL'
      }
    ],
    billingMode: 'PAY_PER_REQUEST',
    stream: 'NEW_AND_OLD_IMAGES'
  }
]
