/**
 * Environment-dependent constants
 * These values change based on the deployment environment (dev, prod, etc.)
 */

const ENV = process.env.ENV_NAME || 'dev';

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

// Export environment for direct access if needed
export const environment = ENV;
