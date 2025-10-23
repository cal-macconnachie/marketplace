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
declare const VITE_API_ENV: 'dev' | 'prod' | undefined;

// Detect environment based on runtime:
// - Backend (Node.js/Lambda): process.env.ENV_NAME (replaced by esbuild)
// - Frontend (Vite): VITE_API_ENV injected at build time via Vite's define
const ENV_NAME = typeof process !== 'undefined' && process.env?.ENV_NAME
  ? process.env.ENV_NAME as 'dev' | 'prod'
  : typeof VITE_API_ENV !== 'undefined' ? VITE_API_ENV : 'dev';

if (ENV_NAME !== 'dev' && ENV_NAME !== 'prod') {
  throw new Error(`Invalid ENV: ${ENV_NAME}`);
}

// DynamoDB Table Names - must match ddb-table-definitions.ts
// Using + instead of template literals for better esbuild constant folding
export const usersTableName = `users-${ENV_NAME}` as const;
export const organizationsTableName = `organizations-${ENV_NAME}` as const;
export const productsTableName = `products-${ENV_NAME}` as const;
export const purchasesTableName = `purchases-${ENV_NAME}` as const;
export const paymentMethodsTableName = `payment-methods-${ENV_NAME}` as const;
export const promosTableName = `promos-${ENV_NAME}` as const;
export const taxCalculationsTableName = `tax-calculations-${ENV_NAME}` as const;
export const rateLimitsTableName = `rate-limits-${ENV_NAME}` as const;
export const oneTimeCodesTableName = `one-time-codes-${ENV_NAME}` as const;
export const purchaseCartsTableName = `purchase-carts-${ENV_NAME}` as const;
export const purchasedProductsTableName = `purchased-products-${ENV_NAME}` as const;
export const notificationsTableName = `notifications-${ENV_NAME}` as const;
export const disputesTableName = `disputes-${ENV_NAME}` as const;

/**
 * Primary domain for the marketplace application
 *
 * IMPORTANT: Changing this domain will automatically update:
 * - S3 bucket names (via s3-bucket-definitions.ts)
 * - Route53 hosted zones (via route53-stack.ts)
 * - Cognito OAuth callback URLs (via cognito-stack.ts)
 * - CloudFront distribution origins
 * - GitHub Actions deployment targets (via .github/scripts/get-domain-config.js)
 *
 * Ensure the new domain's hosted zone exists in Route53 before deploying.
 */
export const domain = ENV_NAME === 'dev' ? 'dev.marketplace.csm.codes' : 'marketplace.csm.codes';

// Export environment for direct access if needed
export const environment = ENV_NAME;
