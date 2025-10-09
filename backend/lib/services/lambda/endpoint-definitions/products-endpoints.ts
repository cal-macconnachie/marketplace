import { LambdaEndpointDefinition } from '@marketplace/types'

/**
 * Product management, promotions, and billing meters
 * Stack: MarketplaceProductsStack
 * Count: 11 Lambda functions
 */
export const productsEndpoints: LambdaEndpointDefinition[] = [
  // Product Management (5 lambdas)
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
    name: 'updateProduct',
    handler: 'product-manager/update.updateProduct',
    description: 'Update Product',
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
    apiGw: {
      path: 'products/{group_id}/{id}',
      method: 'DELETE',
      auth: 'cognito',
      cors: true
    }
  },

  // Promotions & Coupons (4 lambdas)
  {
    name: 'createPromo',
    handler: 'promo-manager/create.createPromo',
    description: 'Create Coupon or Promotion Code',
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
    apiGw: {
      path: 'promos/{type}/{id}',
      method: 'DELETE',
      auth: 'cognito',
      cors: true
    }
  },

  // Billing Meters (3 lambdas)
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
  }
]
