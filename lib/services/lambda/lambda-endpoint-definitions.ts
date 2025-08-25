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
}
export const lambdaEndpointDefinitions: LambdaEndpointDefinition[] = [
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
  },
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
    name: 'superAdminManager',
    handler: 'super-admin-manager-api.superAdminManagerApi',
    description: 'Super Admin Manager API',
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
      path: 'manager/api',
      method: 'POST',
      auth: 'cognito',
      cors: true
    }
  },
  {
    name: 'superAdminManagerPage',
    handler: 'super-admin-manager-page.superAdminManagerPage',
    description: 'Super Admin Manager Page',
    environment: [
      'STRIPE_SECRET_KEY',
      'USER_POOL_CLIENT_ID'
    ],
    apiGw: {
      path: 'manager',
      method: 'GET',
      auth: 'none',
      cors: true
    }
  }
]
