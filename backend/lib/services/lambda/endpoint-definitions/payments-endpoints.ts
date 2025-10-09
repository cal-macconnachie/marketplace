import { LambdaEndpointDefinition } from '@marketplace/types'

/**
 * Payment methods, Stripe operations, and purchase management
 * Stack: MarketplacePaymentsStack
 * Count: 13 Lambda functions
 */
export const paymentsEndpoints: LambdaEndpointDefinition[] = [
  // Payment Methods (3 lambdas)
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

  // Stripe Connect Operations (5 lambdas)
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

  // Purchase Operations (5 lambdas)
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
    apiGw: {
      path: 'organizations/purchased-products',
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
  }
]
