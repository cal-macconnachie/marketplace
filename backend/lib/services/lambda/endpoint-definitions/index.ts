/**
 * Domain-specific Lambda endpoint definitions for split stack architecture
 *
 * Each domain has its own endpoint definitions file and will be deployed as an independent stack.
 * Total: 58 API Lambda functions + 9 event-driven Lambdas = 67 total (removed 2: testStatusCodes deleted, adminChangePassword no API GW)
 */

export { publicEndpoints } from './public-endpoints'
export { paymentsEndpoints } from './payments-endpoints'
export { productsEndpoints } from './products-endpoints'
export { internalApiEndpoints } from './internal-api-endpoints'
export { eventsEndpoints } from './events-endpoints'
