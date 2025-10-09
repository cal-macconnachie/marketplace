/**
 * Domain-specific Lambda endpoint definitions for split stack architecture
 *
 * Each domain has its own endpoint definitions file and will be deployed as an independent stack.
 * Total: 58 API Lambda functions + 9 event-driven Lambdas = 67 total (removed 2: testStatusCodes deleted, adminChangePassword no API GW)
 */

import type { LambdaEndpointDefinition } from '@marketplace/types'
import { publicEndpoints } from './public-endpoints'
import { paymentsEndpoints } from './payments-endpoints'
import { productsEndpoints } from './products-endpoints'
import { internalApiEndpoints } from './internal-api-endpoints'
import { eventsEndpoints } from './events-endpoints'

// Re-export individual endpoint arrays
export { publicEndpoints } from './public-endpoints'
export { paymentsEndpoints } from './payments-endpoints'
export { productsEndpoints } from './products-endpoints'
export { internalApiEndpoints } from './internal-api-endpoints'
export { eventsEndpoints } from './events-endpoints'

/**
 * All endpoint collections mapped by stack name
 * Add new endpoint definitions here to automatically include them in API resource creation
 */
export const allEndpointCollections: Record<string, LambdaEndpointDefinition[]> = {
  Public: publicEndpoints,
  Payments: paymentsEndpoints,
  Products: productsEndpoints,
  InternalApi: internalApiEndpoints,
  Events: eventsEndpoints
}
