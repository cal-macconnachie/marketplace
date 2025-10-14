import { LambdaEndpointDefinition } from '@marketplace/types'

/**
 * Internal API endpoints: Auth (protected), Organizations, Users, Image Upload, and Notifications
 * Stack: MarketplaceInternalApiStack
 * Count: 15 Lambda functions (processImage moved to Networking stack)
 */
export const internalApiEndpoints: LambdaEndpointDefinition[] = [
  // Protected Authentication (3 lambdas)
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

  // Organization Management (2 lambdas)
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

  // User Management (7 lambdas)
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
    name: 'assignProducts',
    handler: 'organizations/assign-products.assignProducts',
    description: 'Assign Products to Organization',
    apiGw: {
      path: 'organizations/assign-products',
      method: 'POST',
      auth: 'cognito',
      cors: true
    }
  },

  // Image Upload (1 lambda - processImage moved to Networking stack)
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

  // Notifications (3 lambdas)
  {
    name: 'getNotifications',
    handler: 'notifications/get-notifications.getNotifications',
    description: 'Get notifications for authenticated user',
    apiGw: {
      path: 'notifications',
      method: 'POST',
      auth: 'cognito',
      cors: true
    }
  },
  {
    name: 'getUnreadNotificationCount',
    handler: 'notifications/get-unread-count.getUnreadNotificationCountHandler',
    description: 'Get unread notification count for authenticated user',
    apiGw: {
      path: 'notifications/unread-count',
      method: 'GET',
      auth: 'cognito',
      cors: true
    }
  },
  {
    name: 'updateNotification',
    handler: 'notifications/update-notification.updateNotification',
    description: 'Update notification read status',
    apiGw: {
      path: 'notifications/update',
      method: 'POST',
      auth: 'cognito',
      cors: true
    }
  }
]
