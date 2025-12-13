import { domain } from '@marketplace/constants'

/**
 * Extract root domain from full domain string
 * @example "dev.marketplace.csm.codes" → "csm.codes"
 * @example "marketplace.csm.codes" → "csm.codes"
 */
export function getRootDomain(fullDomain: string): string {
  const parts = fullDomain.split('.')
  // Take last 2 parts (handles standard TLDs like .com, .codes, .io)
  return parts.slice(-2).join('.')
}

/**
 * Determine if we're in a development environment
 * In dev, we don't use Secure flag to support HTTP
 */
function isDevEnvironment(): boolean {
  return process.env.NODE_ENV === 'development' ||
         process.env.STAGE === 'dev' ||
         process.env.ENV_NAME === 'dev'
}

/**
 * Parse cookie header string into key-value object
 * @param cookieHeader - Cookie header string from request
 * @returns Object with cookie names as keys
 */
export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {}

  return cookieHeader.split(';').reduce((cookies, cookie) => {
    const [
      name,
      ...rest
    ] = cookie.trim().split('=')
    if (name && rest.length > 0) {
      cookies[name] = decodeURIComponent(rest.join('='))
    }
    return cookies
  }, {} as Record<string, string>)
}

/**
 * Create Set-Cookie headers for authentication tokens
 * @param accessToken - Cognito access token
 * @param idToken - Cognito ID token
 * @param refreshToken - Cognito refresh token (optional, may not be present in refresh response)
 * @returns Array of Set-Cookie header strings
 */
export function createAuthCookieHeaders(
  accessToken: string,
  idToken?: string,
  refreshToken?: string
): string[] {
  const rootDomain = getRootDomain(domain)
  const cookieDomain = `.${rootDomain}`
  const secure = !isDevEnvironment()
  const headers: string[] = []

  // Access token - 1 hour
  if (accessToken) {
    headers.push(
      `accessToken=${encodeURIComponent(accessToken)}; Domain=${cookieDomain}; Path=/; Max-Age=3600; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`
    )
  }

  // ID token - 1 hour
  if (idToken) {
    headers.push(
      `authToken=${encodeURIComponent(idToken)}; Domain=${cookieDomain}; Path=/; Max-Age=3600; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`
    )
  }

  // Refresh token - 7 days
  if (refreshToken) {
    headers.push(
      `refreshToken=${encodeURIComponent(refreshToken)}; Domain=${cookieDomain}; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`
    )
  }

  return headers
}

/**
 * Create Set-Cookie headers to clear authentication cookies
 * @returns Array of Set-Cookie header strings that expire the cookies
 */
export function createClearAuthCookieHeaders(): string[] {
  const rootDomain = getRootDomain(domain)
  const cookieDomain = `.${rootDomain}`
  const secure = !isDevEnvironment()

  return [
    `accessToken=; Domain=${cookieDomain}; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`,
    `authToken=; Domain=${cookieDomain}; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`,
    `refreshToken=; Domain=${cookieDomain}; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`
  ]
}

/**
 * Validate origin against allowed domain pattern and return CORS headers
 * Allows root domain and all subdomains dynamically
 * @param origin - Origin header from request
 * @returns Object with CORS headers
 */
export function validateAndGetCorsHeaders(origin: string | undefined): {
  'Access-Control-Allow-Origin': string
  'Access-Control-Allow-Credentials': boolean | string
  'Content-Type': string
} {
  const rootDomain = getRootDomain(domain)
  // Match https://(subdomain.)?rootdomain
  const originRegex = new RegExp(`^https:\\/\\/([a-z0-9-]+\\.)?${rootDomain.replace(/\./g, '\\.')}$`)

  // Validate origin matches our domain pattern
  const allowedOrigin = origin && originRegex.test(origin) ? origin : `https://${domain}`

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Credentials': true,
    'Content-Type': 'application/json'
  }
}
