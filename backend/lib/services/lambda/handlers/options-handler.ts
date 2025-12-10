/**
 * OPTIONS handler for CORS preflight requests
 * Returns appropriate CORS headers based on the origin
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'

// Extract root domain from environment or use default
const ROOT_DOMAIN = 'csm.codes'

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Get the origin from the request headers
  const origin = event.headers.origin || event.headers.Origin

  // Default response headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (origin) {
    // Extract domain from origin (remove protocol)
    const originDomain = origin.replace(/^https?:\/\//, '')

    // Check if origin is root domain or subdomain
    const isRootDomain = originDomain === ROOT_DOMAIN
    const isSubdomain = originDomain.endsWith(`.${ROOT_DOMAIN}`)

    if (isRootDomain || isSubdomain) {
      // Allow this specific origin with credentials
      headers['Access-Control-Allow-Origin'] = origin
      headers['Access-Control-Allow-Credentials'] = 'true'
      headers['Access-Control-Allow-Methods'] = 'GET,HEAD,OPTIONS,PUT,POST,PATCH,DELETE'
      headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-Requested-With,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'
      headers['Access-Control-Max-Age'] = '600'
    }
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ message: 'OK' }),
  }
}
