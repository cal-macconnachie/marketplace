/**
 * Environment-dependent constants
 * Works in both Node.js (backend) and browser (frontend) environments
 *
 * For Lambda functions, esbuild's define option will replace process.env.ENV_NAME
 * with the actual environment string at build time, allowing full constant inlining.
 *
 * For frontend (Vite), VITE_API_ENV is injected at build time via Vite's define.
 *
 * IMPORTANT: Using plain string concatenation (+) instead of template literals
 * allows esbuild to fully inline these constants at build time.
 */

// Declare global for Vite's injected variable
declare const VITE_API_ENV: string | undefined;

// Detect environment based on runtime:
// - Backend (Node.js/Lambda): process.env.ENV_NAME (replaced by esbuild)
// - Frontend (Vite): VITE_API_ENV injected at build time via Vite's define
const ENV_NAME = typeof process !== 'undefined' && process.env?.ENV_NAME
  ? process.env.ENV_NAME
  : typeof VITE_API_ENV !== 'undefined' ? VITE_API_ENV : 'dev';

// DynamoDB Table Names - must match ddb-table-definitions.ts
// Using + instead of template literals for better esbuild constant folding
export const usersTableName = 'users-' + ENV_NAME;
export const organizationsTableName = 'organizations-' + ENV_NAME;
export const productsTableName = 'products-' + ENV_NAME;
export const purchasesTableName = 'purchases-' + ENV_NAME;
export const paymentMethodsTableName = 'payment-methods-' + ENV_NAME;
export const promosTableName = 'promos-' + ENV_NAME;
export const taxCalculationsTableName = 'tax-calculations-' + ENV_NAME;
export const rateLimitsTableName = 'rate-limits-' + ENV_NAME;
export const oneTimeCodesTableName = 'one-time-codes-' + ENV_NAME;
export const purchaseCartsTableName = 'purchase-carts-' + ENV_NAME;
export const purchasedProductsTableName = 'purchased-products-' + ENV_NAME;
export const notificationsTableName = 'notifications-' + ENV_NAME;
export const disputesTableName = 'disputes-' + ENV_NAME;

export const domain = ENV_NAME === 'dev' ? 'dev.marketplace.csm.codes' : 'marketplace.csm.codes';

// Export environment for direct access if needed
export const environment = ENV_NAME;
