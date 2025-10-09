import { LambdaEndpointDefinition } from '@marketplace/types'

/**
 * Public API endpoints that don't require authentication
 * Stack: MarketplacePublicStack
 * Count: 11 Lambda functions
 */
export const publicEndpoints: LambdaEndpointDefinition[] = [
  // Authentication & Authorization (6 lambdas)
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

  // Public Product & Organization Reads (3 lambdas)
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

  // Public Payment Operations (2 lambdas)
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
  }
]
