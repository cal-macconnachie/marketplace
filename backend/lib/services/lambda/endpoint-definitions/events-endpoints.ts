import { LambdaEndpointDefinition } from '@marketplace/types'

/**
 * Event-driven Lambda functions (DynamoDB Streams and EventBridge)
 * Stack: MarketplaceEventsStack
 * Count: 9 Lambda functions
 * Note: These functions DO NOT need API Gateway - they are event-driven only
 */
export const eventsEndpoints: LambdaEndpointDefinition[] = [
  // EventBridge Handlers (4 lambdas)
  {
    name: 'eventHandler',
    handler: 'stripe-event-handler.stripeEventHandler',
    description: 'Handle Stripe Connected Account events via EventBridge',
    environment: [
      'STRIPE_SECRET_KEY',
      'STRIPE_EVENT_DESTINATION'
    ],
    eventBridgeEvent: {
      detailType: 'Stripe Event',
      enabled: true,
      pattern: {
        source: [{ prefix: 'aws.partner/stripe.com' }],
        'detail-type': [
          'account.updated',
          'invoice.paid',
          'invoice.payment_failed',
          'payment_intent.succeeded'
        ]
      }
    }
  },
  {
    name: 'platformEventHandler',
    handler: 'stripe-platform-event-handler.stripePlatformEventHandler',
    description: 'Handle Stripe Platform account events via EventBridge (destination charges)',
    environment: [
      'STRIPE_SECRET_KEY',
      'STRIPE_EVENT_DESTINATION_PLATFORM'
    ],
    eventBridgeEvent: {
      detailType: 'Stripe Event',
      enabled: true,
      pattern: {
        source: [{ prefix: 'aws.partner/stripe.com' }],
        'detail-type': [
          'setup_intent.succeeded',
          'setup_intent.setup_failed',
          'payment_intent.succeeded',
          'payment_intent.payment_failed',
          'payment_intent.requires_action',
          'transfer.created',
          'application_fee.created',
          'charge.dispute.created',
          'invoice.paid',
          'invoice.payment_failed',
          'customer.subscription.created',
          'customer.subscription.updated'
        ]
      }
    }
  },
  {
    name: 'handlePurchase',
    handler: 'stripe/handle-purchase.handlePurchase',
    description: 'Handle purchase events originating from DynamoDB stream',
    environment: ['STRIPE_SECRET_KEY'],
    eventBridgeEvent: {
      detailType: 'pending-purchases-added',
      enabled: true
    }
  },
  {
    name: 'productsPurchased',
    handler: 'payments/products-purchased.productsPurchased',
    description: 'Handle products purchased event and send receipt',
    eventBridgeEvent: {
      detailType: 'products-purchased',
      enabled: true
    },
    bundleTemplate: ['receipt.hbs'],
    environment: [
      'EMAIL_LAMBDA_ARN',
      'SMS_LAMBDA_ARN',
      'EMAIL_AWS_REGION',
      'EMAIL_ASSUME_ROLE_ARN'
    ],
    iamPolicies: [
      {
        actions: ['sts:AssumeRole'],
        resources: ['arn:aws:iam::472312425428:role/cross-dev-lambdaInvokeFrom-629891807011']
      }
    ]
  },

  // DynamoDB Stream Handlers (6 lambdas) - Note: 'products' conflicts with products-stack, renamed to 'productsStream'
  {
    name: 'productsStream',
    handler: 'products.handler',
    description: 'Handle Stripe product updates via DynamoDB stream',
    environment: ['STRIPE_SECRET_KEY'],
    dynamoStreamEvent: {
      tableName: 'products',
      enabled: true,
      batchSize: 1
    }
  },
  {
    name: 'promosStream',
    handler: 'promos.promos',
    description: 'Handle Stripe coupon and promotion code updates via DynamoDB stream',
    environment: ['STRIPE_SECRET_KEY'],
    dynamoStreamEvent: {
      tableName: 'promos',
      enabled: true,
      batchSize: 1
    }
  },
  {
    name: 'usersStream',
    handler: 'users.users',
    description: 'Handle user updates via DynamoDB stream',
    environment: ['STRIPE_SECRET_KEY'],
    dynamoStreamEvent: {
      tableName: 'users',
      enabled: true,
      batchSize: 1
    }
  },
  {
    name: 'organizationsStream',
    handler: 'organizations.organizations',
    description: 'Handle organization updates via DynamoDB stream',
    environment: ['STRIPE_SECRET_KEY'],
    dynamoStreamEvent: {
      tableName: 'organizations',
      enabled: true,
      batchSize: 1
    }
  },
  {
    name: 'purchaseCartsStream',
    handler: 'purchase-carts.handler',
    description: 'Handle purchase cart updates via DynamoDB stream and send receipts when all items processed',
    dynamoStreamEvent: {
      tableName: 'purchase-carts',
      enabled: true,
      batchSize: 1
    },
    iamPolicies: [
      {
        actions: ['events:PutEvents'],
        resources: ['*']
      }
    ]
  },
  {
    name: 'purchasesStream',
    handler: 'purchases.purchases',
    description: 'Handle purchase events via DynamoDB stream',
    dynamoStreamEvent: {
      tableName: 'purchases',
      enabled: true,
      batchSize: 1
    },
    iamPolicies: [
      {
        actions: ['events:PutEvents'],
        resources: ['*']
      }
    ]
  }
]
