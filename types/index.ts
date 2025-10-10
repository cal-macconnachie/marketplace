/**
 * Shared types for Marketplace monorepo
 * This file provides organized exports for all entity, API, and internal types
 */

// ============================================================================
// ENTITIES - Core business objects
// ============================================================================

export * from './entities/user'
export * from './entities/organization'
export * from './entities/product'
export * from './entities/payment'
export * from './entities/promo'
export * from './entities/meter'
export * from './entities/notification'

// ============================================================================
// API TYPES - Request/Response interfaces organized by domain
// ============================================================================

// Auth
export * from './api/auth/requests'
export * from './api/auth/responses'

// Products
export * from './api/products/requests'
export * from './api/products/responses'

// Payments
export * from './api/payments/requests'
export * from './api/payments/responses'

// Stripe
export * from './api/stripe/requests'
export * from './api/stripe/responses'

// Promos
export * from './api/promos/requests'
export * from './api/promos/responses'

// Meters
export * from './api/meters/requests'
export * from './api/meters/responses'

// Images
export * from './api/images/requests'
export * from './api/images/responses'

// Taxes
export * from './api/taxes/requests'

// Organizations
export * from './api/organizations/requests'
export * from './api/organizations/responses'

// Emails
export * from './api/emails/receipt'

// ============================================================================
// INFRASTRUCTURE TYPES - CDK stack definitions
// ============================================================================

export * from './infrastructure/dynamodb'
export * from './infrastructure/s3'
export * from './infrastructure/cloudfront'
export * from './infrastructure/lambda'
export * from './infrastructure/cdk-stacks'

// ============================================================================
// UTILITY TYPES - Shared utilities for frontend and backend
// ============================================================================

export * from './utils/validation'
export * from './utils/cart'
export * from './utils/theme'
export * from './utils/select'
export * from './utils/embed'
export * from './utils/oauth'

// ============================================================================
// INTERNAL TYPES - Backend-only utilities
// Note: These are exported but marked with @internal JSDoc tags
// ============================================================================

export * from './internal/handler-utils'
export * from './internal/query-strategies'
export * from './internal/otp'
export * from './internal/email'
export * from './internal/eventbridge'
export * from './internal/tax'
export * from './internal/stripe-helpers'
export * from './internal/dynamodb-helpers'