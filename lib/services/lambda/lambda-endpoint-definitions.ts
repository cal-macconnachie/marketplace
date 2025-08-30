export interface LambdaEndpointDefinition {
  name: string
  handler: string
  description: string
  timeout?: number // Timeout in seconds, default is 30 seconds
  memorySize?: number // Memory size in MB, default is 128 MB
  environment?: string[]
  iamPolicies?: Array<{
    actions: string[]
    resources: string[]
  }>
  queues?: string[] // List of SQS queue names this endpoint interacts with
  apiGw?: {
    path: string // API Gateway path for this endpoint
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
    auth: 'none' | 'apiKey' | 'cognito'
    cors: boolean // Enable CORS for this endpoint
  }
  /**
   * If set, this Lambda will be triggered by the specified SQS queue (event source mapping).
   * Use this for rate-limited/event-driven processing.
   */
  queueEvent?: {
    queueName: string
    batchSize?: number
    enabled?: boolean
    maximumBatchingWindow?: number // New property for maximum batching window in milliseconds
  }
  buckets?: string[] // List of S3 bucket names this endpoint interacts with
  /**
   * If set, this Lambda will be triggered by the specified DynamoDB table stream (event source mapping).
   */
  dynamoStreamEvent?: {
    tableName: string
    batchSize?: number
    enabled?: boolean
  }
  /**
   * If set, this Lambda will be triggered by the specified EventBridge event (event source mapping).
   */
  eventBridgeEvent?: {
    detailType: string
    enabled?: boolean
    eventBus?: string // Optional, specify if using a custom event bus
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pattern?: Record<string, any> // Optional event pattern for filtering events
  }
  streaming?: boolean // Enable Lambda response streaming for this endpoint
  /**
   * If set, these HTML files will be bundled with the Lambda function and available at runtime.
   * Paths should be relative to the handlers directory.
   */
  bundleHtml?: string[] // List of HTML files to bundle with this specific Lambda
}
export const lambdaEndpointDefinitions: LambdaEndpointDefinition[] = [
  // Authentication & Authorization
  {
    name: 'register',
    handler: 'auth/register.register',
    description: 'Register',
    environment: [
      'USER_POOL_CLIENT_ID',
      'USER_POOL_ID'
    ],
    iamPolicies: [
      {
        actions: ['cognito-idp:SignUp'],
        resources: ['*']
      }
    ],
    apiGw: {
      path: 'auth/register',
      method: 'POST',
      auth: 'none',
      cors: true
    }
  },
  {
    name: 'login',
    handler: 'auth/login.login',
    description: 'Login',
    environment: ['USER_POOL_CLIENT_ID'],
    iamPolicies: [
      {
        actions: ['cognito-idp:InitiateAuth'],
        resources: ['*']
      }
    ],
    apiGw: {
      path: 'auth/login',
      method: 'POST',
      auth: 'none',
      cors: true
    }
  },
  {
    name: 'refresh',
    handler: 'auth/refresh.refresh',
    description: 'Refresh Token',
    environment: ['USER_POOL_CLIENT_ID'],
    iamPolicies: [
      {
        actions: ['cognito-idp:AdminUserGlobalSignOut'],
        resources: ['*']
      }
    ],
    apiGw: {
      path: 'auth/refresh',
      method: 'POST',
      auth: 'none',
      cors: true
    }
  },
  {
    name: 'logout',
    handler: 'auth/logout.logout',
    description: 'Logout',
    environment: ['USER_POOL_CLIENT_ID'],
    iamPolicies: [
      {
        actions: ['cognito-idp:AdminUserGlobalSignOut'],
        resources: ['*']
      }
    ],
    apiGw: {
      path: 'auth/logout',
      method: 'POST',
      auth: 'cognito',
      cors: true
    }
  },
  {
    name: 'changePassword',
    handler: 'auth/change-password.changePassword',
    description: 'Change Password',
    environment: ['USER_POOL_CLIENT_ID'],
    iamPolicies: [
      {
        actions: ['cognito-idp:ChangePassword'],
        resources: ['*']
      }
    ],
    apiGw: {
      path: 'auth/change-password',
      method: 'POST',
      auth: 'cognito',
      cors: true
    }
  },
  {
    name: 'adminChangePassword',
    handler: 'auth/admin-change-password.adminChangePassword',
    description: 'Admin Change Password',
    environment: [
      'USER_POOL_CLIENT_ID',
      'USER_POOL_ID'
    ],
    iamPolicies: [
      {
        actions: ['cognito-idp:AdminSetUserPassword'],
        resources: ['*']
      }
    ]
  },

  // Payment Methods & Processing
  {
    name: 'createPaymentMethod',
    handler: 'payments/create-payment-method.createPaymentMethod',
    description: 'Create Payment Method',
    environment: ['STRIPE_SECRET_KEY'],
    apiGw: {
      path: 'create-payment-method',
      method: 'POST',
      auth: 'cognito',
      cors: true
    }
  },
  {
    name: 'getPaymentMethods',
    handler: 'payments/get-payment-methods.getPaymentMethods',
    description: 'Get Payment Methods',
    environment: ['STRIPE_SECRET_KEY'],
    iamPolicies: [
      {
        actions: ['cognito-idp:GetUser'],
        resources: ['*']
      }
    ],
    apiGw: {
      path: 'get-payment-methods',
      method: 'POST',
      auth: 'cognito',
      cors: true
    }
  },
  {
    name: 'archivePaymentMethod',
    handler: 'payments/archive-payment-method.archivePaymentMethod',
    description: 'Archive Payment Method',
    environment: ['STRIPE_SECRET_KEY'],
    apiGw: {
      path: 'archive-payment-method',
      method: 'POST',
      auth: 'cognito',
      cors: true
    }
  },

  // Products & Purchases
  {
    name: 'createProduct',
    handler: 'product-manager/create.createProduct',
    description: 'Create Product',
    environment: ['TABLE_PRODUCTS'],
    apiGw: {
      path: 'products',
      method: 'POST',
      auth: 'cognito',
      cors: true
    }
  },
  {
    name: 'getProduct',
    handler: 'product-manager/get.getProduct',
    description: 'Get Product by ID',
    environment: ['TABLE_PRODUCTS'],
    apiGw: {
      path: 'products/{group_id}/{id}',
      method: 'GET',
      auth: 'cognito',
      cors: true
    }
  },
  {
    name: 'listProducts',
    handler: 'product-manager/list.listProducts',
    description: 'List Products',
    environment: ['TABLE_PRODUCTS'],
    apiGw: {
      path: 'products',
      method: 'GET',
      auth: 'cognito',
      cors: true
    }
  },
  {
    name: 'updateProduct',
    handler: 'product-manager/update.updateProduct',
    description: 'Update Product',
    environment: ['TABLE_PRODUCTS'],
    apiGw: {
      path: 'products/{group_id}/{id}',
      method: 'PUT',
      auth: 'cognito',
      cors: true
    }
  },
  {
    name: 'deleteProduct',
    handler: 'product-manager/delete.deleteProduct',
    description: 'Delete Product',
    environment: ['TABLE_PRODUCTS'],
    apiGw: {
      path: 'products/{group_id}/{id}',
      method: 'DELETE',
      auth: 'cognito',
      cors: true
    }
  },
  {
    name: 'getProducts',
    handler: 'payments/get-products.getProducts',
    description: 'Get Products',
    environment: [
      'STRIPE_SECRET_KEY',
      'USER_POOL_CLIENT_ID'
    ],
    iamPolicies: [
      {
        actions: ['cognito-idp:GetUser'],
        resources: ['*']
      }
    ],
    apiGw: {
      path: 'get-products',
      method: 'POST',
      auth: 'cognito',
      cors: true
    }
  },
  {
    name: 'purchaseProducts',
    handler: 'payments/purchase-products.purchaseProducts',
    description: 'Purchase Products',
    environment: ['STRIPE_SECRET_KEY'],
    apiGw: {
      path: 'purchase-products',
      method: 'POST',
      auth: 'cognito',
      cors: true
    }
  },
  {
    name: 'purchases',
    handler: 'purchases.purchasesCrud',
    description: 'operations for purchases',
    environment: ['STRIPE_SECRET_KEY'],
    apiGw: {
      path: 'purchases',
      method: 'POST',
      auth: 'cognito',
      cors: true
    }
  },
  {
    name: 'cancelSubscription',
    handler: 'payments/cancel-subscription.cancelSubscription',
    description: 'Cancel Subscription',
    environment: ['STRIPE_SECRET_KEY'],
    apiGw: {
      path: 'cancel-subscription',
      method: 'POST',
      auth: 'cognito',
      cors: true
    }
  },

  // Promotions & Coupons Management
  {
    name: 'createPromo',
    handler: 'promo-manager/create.createPromo',
    description: 'Create Coupon or Promotion Code',
    environment: ['TABLE_PROMOS'],
    apiGw: {
      path: 'promos',
      method: 'POST',
      auth: 'cognito',
      cors: true
    }
  },
  {
    name: 'listPromos',
    handler: 'promo-manager/list.listPromos',
    description: 'List Coupons or Promotion Codes',
    environment: ['TABLE_PROMOS'],
    apiGw: {
      path: 'promos',
      method: 'GET',
      auth: 'cognito',
      cors: true
    }
  },
  {
    name: 'updatePromos',
    handler: 'promo-manager/update.updatePromos',
    description: 'Update Coupon or Promotion Code',
    environment: ['STRIPE_SECRET_KEY'],
    apiGw: {
      path: 'promos/{type}/{id}',
      method: 'PUT',
      auth: 'cognito',
      cors: true
    }
  },
  {
    name: 'deletePromo',
    handler: 'promo-manager/delete.deletePromo',
    description: 'Delete Coupon or Promotion Code',
    environment: ['TABLE_PROMOS'],
    apiGw: {
      path: 'promos/{type}/{id}',
      method: 'DELETE',
      auth: 'cognito',
      cors: true
    }
  },

  // Billing Meters Management
  {
    name: 'createMeter',
    handler: 'meter-manager/create.createMeter',
    description: 'Create Billing Meter',
    environment: ['STRIPE_SECRET_KEY'],
    apiGw: {
      path: 'meters',
      method: 'POST',
      auth: 'cognito',
      cors: true
    }
  },
  {
    name: 'listMeters',
    handler: 'meter-manager/list.listMeters',
    description: 'List Billing Meters',
    environment: ['STRIPE_SECRET_KEY'],
    apiGw: {
      path: 'meters',
      method: 'GET',
      auth: 'cognito',
      cors: true
    }
  },
  {
    name: 'deactivateMeter',
    handler: 'meter-manager/deactivate.deactivateMeter',
    description: 'Deactivate Billing Meter',
    environment: ['STRIPE_SECRET_KEY'],
    apiGw: {
      path: 'meters/{id}',
      method: 'DELETE',
      auth: 'cognito',
      cors: true
    }
  },

  // Organization Management
  {
    name: 'addUserToOrganization',
    handler: 'organizations/add-user-to-organization.add',
    description: 'Add User To Organization',
    environment: ['STRIPE_SECRET_KEY'],
    apiGw: {
      path: 'add-user-to-organization',
      method: 'POST',
      auth: 'cognito',
      cors: true
    }
  },
  {
    name: 'removeUserFromOrganization',
    handler: 'organizations/remove-user-from-organization.remove',
    description: 'Remove User From Organization',
    environment: ['STRIPE_SECRET_KEY'],
    apiGw: {
      path: 'remove-user-from-organization',
      method: 'POST',
      auth: 'cognito',
      cors: true
    }
  },
  {
    name: 'createUser',
    handler: 'organizations/create-user.createUser',
    description: 'Create User',
    environment: ['STRIPE_SECRET_KEY'],
    apiGw: {
      path: 'create-user',
      method: 'POST',
      auth: 'cognito',
      cors: true
    }
  },
  {
    name: 'setOrgAdmin',
    handler: 'organizations/set-org-admin.setOrgAdmin',
    description: 'Set Organization Admin',
    environment: ['STRIPE_SECRET_KEY'],
    apiGw: {
      path: 'set-org-admin',
      method: 'POST',
      auth: 'cognito',
      cors: true
    }
  },
  {
    name: 'getUsers',
    handler: 'organizations/get-users.getUsers',
    description: 'Get Users',
    environment: ['STRIPE_SECRET_KEY'],
    apiGw: {
      path: 'get-users',
      method: 'POST',
      auth: 'cognito',
      cors: true
    }
  },
  {
    name: 'updateUser',
    handler: 'organizations/update-user.updateUser',
    description: 'Update User',
    environment: ['STRIPE_SECRET_KEY'],
    apiGw: {
      path: 'update-user',
      method: 'POST',
      auth: 'cognito',
      cors: true
    }
  },
  {
    name: 'getOrganization',
    handler: 'organizations/get-organization.getOrganization',
    description: 'Get Organization',
    apiGw: {
      path: 'get-organization',
      method: 'POST',
      auth: 'cognito',
      cors: true
    }
  },

  // Event-Driven Processing
  {
    name: 'eventHandler',
    handler: 'stripe-event-handler.stripeEventHandler',
    description: 'Handle Stripe events via EventBridge',
    environment: [
      'STRIPE_SECRET_KEY',
      'STRIPE_EVENT_DESTINATION'
    ],
    eventBridgeEvent: {
      detailType: 'Stripe Event',
      enabled: true,
      pattern: {
        // source starts with aws.partner/stripe.com
        source: [{ prefix: 'aws.partner/stripe.com' }],
        // "detail-type":"customer.created",
        'detail-type': [
          'invoice.paid',
          'invoice.payment_failed'
        ]
      }
    }
  },

  // DynamoDB Stream Handlers
  {
    name: 'products',
    handler: 'products.handler',
    description: 'Handle Stripe product updates via DynamoDB stream',
    environment: ['STRIPE_SECRET_KEY'],
    dynamoStreamEvent: {
      tableName: 'products',
      enabled: true,
      batchSize: 1 // Adjust based on expected throughput
    }
  },
  {
    name: 'promos',
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
    name: 'users',
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
    name: 'organizations',
    handler: 'organizations.organizations',
    description: 'Handle organization updates via DynamoDB stream',
    environment: ['STRIPE_SECRET_KEY'],
    dynamoStreamEvent: {
      tableName: 'organizations',
      enabled: true,
      batchSize: 1
    }
  }
]
