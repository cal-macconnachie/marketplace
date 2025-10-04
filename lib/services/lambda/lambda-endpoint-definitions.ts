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
   * If set, these template files will be bundled with the Lambda function and available at runtime.
   * Paths are relative to lib/services/lambda/templates (supports nested directories).
   * They will be copied into the Lambda bundle preserving the relative directory structure.
   */
  bundleTemplate?: string[] // List of template files to bundle with this specific Lambda
  /**
   * If set to true, uses native dependency bundling (required for packages like Sharp, Canvas, etc.)
   * This enables proper Linux binary compilation for Lambda runtime.
   */
  requiresNativeDeps?: boolean
}
export const lambdaEndpointDefinitions: LambdaEndpointDefinition[] = [
  // Authentication & Authorization
  {
    name: 'requestRegisterOtp',
    handler: 'auth/request-register-otp.requestRegisterOtp',
    description: 'Request registration OTP (send OTP email)',
    environment: [
      'EMAIL_LAMBDA_ARN',
      'EMAIL_AWS_REGION',
      'EMAIL_ASSUME_ROLE_ARN'
    ],
    iamPolicies: [
      {
        actions: ['sts:AssumeRole'],
        resources: ['arn:aws:iam::472312425428:role/cross-dev-lambdaInvokeFrom-629891807011']
      }
    ],
    bundleTemplate: ['registration.hbs'],
    apiGw: {
      path: 'auth/request-register-otp',
      method: 'POST',
      auth: 'none',
      cors: true
    }
  },
  {
    name: 'requestResetPassword',
    handler: 'auth/request-reset-password.requestResetPassword',
    description: 'Request password reset (send OTP email)',
    environment: [
      'EMAIL_LAMBDA_ARN',
      'EMAIL_AWS_REGION',
      'EMAIL_ASSUME_ROLE_ARN'
    ],
    iamPolicies: [
      {
        actions: ['sts:AssumeRole'],
        resources: ['arn:aws:iam::472312425428:role/cross-dev-lambdaInvokeFrom-629891807011']
      }
    ],
    // Bundle reset email template into the function package
    bundleTemplate: ['reset-password.hbs'],
    apiGw: {
      path: 'auth/request-reset-password',
      method: 'POST',
      auth: 'none',
      cors: true
    }
  },
  {
    name: 'resetPassword',
    handler: 'auth/reset-password.resetPassword',
    description: 'Reset password using OTP',
    environment: ['USER_POOL_ID'],
    iamPolicies: [
      {
        actions: ['cognito-idp:AdminSetUserPassword'],
        resources: ['*']
      }
    ],
    apiGw: {
      path: 'auth/reset-password',
      method: 'POST',
      auth: 'none',
      cors: true
    }
  },
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
    name: 'createConnectedAccount',
    handler: 'stripe/create-connected-account.createConnectedAccountHandler',
    description: 'Create Stripe Connected Account for marketplace sellers',
    environment: ['STRIPE_SECRET_KEY'],
    apiGw: {
      path: 'stripe/create-connected-account',
      method: 'POST',
      auth: 'cognito',
      cors: true
    }
  },
  {
    name: 'refreshConnectUrl',
    handler: 'stripe/refresh-connect-url.refreshConnectUrl',
    description: 'Refresh Stripe Connect URL',
    environment: ['STRIPE_SECRET_KEY'],
    apiGw: {
      path: 'stripe/refresh-connect-url',
      method: 'POST',
      auth: 'cognito',
      cors: true
    }
  },
  {
    name: 'createExpressLoginLink',
    handler: 'stripe/create-express-login-link.createExpressLoginLinkHandler',
    description: 'Create login link for Stripe Express Dashboard',
    environment: ['STRIPE_SECRET_KEY'],
    apiGw: {
      path: 'stripe/express-login-link',
      method: 'POST',
      auth: 'cognito',
      cors: true
    }
  },
  {
    name: 'deleteConnectedAccounts',
    handler: 'stripe/delete-connected-accounts.deleteConnectedAccounts',
    description: 'Delete Stripe Connected Accounts',
    environment: ['STRIPE_SECRET_KEY']
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
    apiGw: {
      path: 'products/{group_id}/{id}',
      method: 'GET',
      auth: 'cognito',
      cors: true
    }
  },
  {
    name: 'publicGetProduct',
    handler: 'product-manager/get.publicGetProduct',
    description: 'Get Product by ID (Public)',
    apiGw: {
      path: 'public/products/{group_id}/{id}',
      method: 'GET',
      auth: 'none',
      cors: true
    }
  },
  {
    name: 'listProducts',
    handler: 'product-manager/list.listProducts',
    description: 'List Products',
    apiGw: {
      path: 'products',
      method: 'GET',
      auth: 'cognito',
      cors: true
    }
  },
  {
    name: 'publicListProducts',
    handler: 'product-manager/list.publicListProducts',
    description: 'List Public Products',
    apiGw: {
      path: 'public/products',
      method: 'POST',
      auth: 'none',
      cors: true
    }
  },
  {
    name: 'updateProduct',
    handler: 'product-manager/update.updateProduct',
    description: 'Update Product',
    environment: ['PRODUCTS_TABLE'],
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
    environment: ['PRODUCTS_TABLE'],
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
    },
    iamPolicies: [
      {
        actions: ['events:PutEvents'],
        resources: ['*']
      }
    ]
  },
  {
    name: 'productsPurchased',
    handler: 'payments/products-purchased.productsPurchased',
    description: 'Handle products purchased event and send receipt',
    eventBridgeEvent: {
      detailType: 'products-purchased',
      enabled: true
    },
    // Bare filename -> templates directory
    bundleTemplate: ['receipt.hbs'],
    environment: [
      'EMAIL_LAMBDA_ARN',
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
  {
    name: 'purchases',
    handler: 'payments/purchases-crud.purchasesCrud',
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
    name: 'getPurchasedProducts',
    handler: 'organizations/get-purchased-products.getPurchasedProducts',
    description: 'Get Purchased Products',
    environment: ['PURCHASED_PRODUCTS_TABLE'],
    apiGw: {
      path: 'organizations/purchased-products',
      method: 'POST',
      auth: 'cognito',
      cors: true
    }
  },
  {
    name: 'calculateTaxes',
    handler: 'payments/calculate-taxes.calculateTaxes',
    description: 'Calculate Taxes',
    environment: ['STRIPE_SECRET_KEY'],
    apiGw: {
      path: 'calculate-taxes',
      method: 'POST',
      auth: 'none',
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
    environment: ['PROMOS_TABLE'],
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
    environment: ['PROMOS_TABLE'],
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
    environment: ['PROMOS_TABLE'],
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
    name: 'guestCheckout',
    handler: 'payments/guest-checkout.guestCheckout',
    description: 'Guest Checkout with User Creation, Payment Method, and Product Purchase',
    environment: ['STRIPE_SECRET_KEY'],
    apiGw: {
      path: 'guest-checkout',
      method: 'POST',
      auth: 'none',
      cors: true
    },
    iamPolicies: [
      {
        actions: ['events:PutEvents'],
        resources: ['*']
      }
    ]
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
  {
    name: 'publicGetOrganization',
    handler: 'organizations/get-organization.publicGetOrganization',
    description: 'Get Organization',
    apiGw: {
      path: 'public/organizations/{id}',
      method: 'GET',
      auth: 'none',
      cors: true
    }
  },
  {
    name: 'updateOrganization',
    handler: 'organizations/update.updateOrganizationHandler',
    description: 'Update Organization',
    apiGw: {
      path: 'update-organization',
      method: 'POST',
      auth: 'cognito',
      cors: true
    }
  },

  // Event-Driven Processing
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
        // source starts with aws.partner/stripe.com
        source: [{ prefix: 'aws.partner/stripe.com' }],
        // Connected account events only
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
        // source starts with aws.partner/stripe.com
        source: [{ prefix: 'aws.partner/stripe.com' }],
        // Platform account events for destination charges
        'detail-type': [
          'payment_intent.succeeded',
          'payment_intent.payment_failed',
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
  },
  {
    name: 'purchase-carts',
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
  },

  // Image Processing
  {
    name: 'processImage',
    handler: 'images/image-processor.processImage',
    description: 'Process and resize images from S3',
    timeout: 30,
    memorySize: 1024,
    buckets: ['dot-images-product-store-direct'],
    environment: ['IMAGES_BUCKET_NAME'],
    requiresNativeDeps: true,
    iamPolicies: [
      {
        actions: ['s3:GetObject'],
        resources: ['*']
      }
    ],
    apiGw: {
      path: 'images/{proxy+}',
      method: 'GET',
      auth: 'none',
      cors: true
    }
  },
  {
    name: 'createPresignedUploadUrl',
    handler: 'images/presigned-upload.createPresignedUploadUrl',
    description: 'Create presigned URLs for direct S3 image uploads',
    buckets: ['dot-images-product-store-direct'],
    environment: ['IMAGES_BUCKET_NAME'],
    iamPolicies: [
      {
        actions: ['s3:PutObject'],
        resources: ['*']
      }
    ],
    apiGw: {
      path: 'images/presigned-upload',
      method: 'POST',
      auth: 'cognito',
      cors: true
    }
  },

  // Stripe Meter Events
  {
    name: 'logMeterEvent',
    handler: 'stripe/log-meter-event.logMeterEventHandler',
    description: 'Log Stripe meter event for usage-based billing',
    environment: ['STRIPE_SECRET_KEY'],
    apiGw: {
      path: 'stripe/log-meter-event',
      method: 'POST',
      auth: 'cognito',
      cors: true
    }
  },

  // Test Endpoint Definitions
  {
    name: 'testStatusCodes',
    handler: 'test/status-codes.checkStatusCode',
    description: 'Test Status Codes',
    apiGw: {
      path: 'test-status-codes/{status_code}',
      method: 'POST',
      auth: 'cognito',
      cors: true
    }
  }
]
