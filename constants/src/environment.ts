/**
 * Environment-dependent constants
 * Works in both Node.js (backend) and browser (frontend) environments
 */

// Check if running in browser (window exists) or Node.js (process exists)
const ENV = (() => {
  // Browser environment - check window object for Vite injected env
  if (typeof window !== 'undefined' && (window as any).__MARKETPLACE_ENV__) {
    return (window as any).__MARKETPLACE_ENV__;
  }
  // Node.js environment
  if (typeof process !== 'undefined' && process.env?.ENV_NAME) {
    return process.env.ENV_NAME;
  }
  // Default fallback
  return 'dev';
})();

/**
 * Get environment-specific table name
 */
const getTableName = (baseName: string): string => {
  return `${baseName}-${ENV}`;
};

// DynamoDB Table Names - must match ddb-table-definitions.ts
export const usersTableName = getTableName('users');
export const organizationsTableName = getTableName('organizations');
export const productsTableName = getTableName('products');
export const purchasesTableName = getTableName('purchases');
export const paymentMethodsTableName = getTableName('payment-methods');
export const promosTableName = getTableName('promos');
export const taxCalculationsTableName = getTableName('tax-calculations');
export const rateLimitsTableName = getTableName('rate-limits');
export const oneTimeCodesTableName = getTableName('one-time-codes');
export const purchaseCartsTableName = getTableName('purchase-carts');
export const purchasedProductsTableName = getTableName('purchased-products');
export const notificationsTableName = getTableName('notifications');

// Export environment for direct access if needed
export const environment = ENV;
