/**
 * Cookie utility functions for secure token storage
 */

interface CookieOptions {
  maxAge?: number // in seconds
  path?: string
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
  domain?: string
}

/**
 * Set a cookie with the given name and value
 */
export function setCookie(name: string, value: string, options: CookieOptions = {}): void {
  const {
    maxAge,
    path = '/',
    secure = window.location.protocol === 'https:',
    sameSite = 'lax',
    domain,
  } = options

  let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`

  if (maxAge !== undefined) {
    cookieString += `; Max-Age=${maxAge}`
  }

  cookieString += `; Path=${path}`

  if (secure) {
    cookieString += '; Secure'
  }

  cookieString += `; SameSite=${sameSite}`

  if (domain) {
    cookieString += `; Domain=${domain}`
  }

  document.cookie = cookieString
}

/**
 * Get a cookie value by name
 */
export function getCookie(name: string): string | null {
  const nameEQ = encodeURIComponent(name) + '='
  const cookies = document.cookie.split(';')

  for (let i = 0; i < cookies.length; i++) {
    let cookie = cookies[i]
    while (cookie.charAt(0) === ' ') {
      cookie = cookie.substring(1)
    }
    if (cookie.indexOf(nameEQ) === 0) {
      return decodeURIComponent(cookie.substring(nameEQ.length))
    }
  }

  return null
}

/**
 * Remove a cookie by name
 */
export function removeCookie(name: string, options: Pick<CookieOptions, 'path' | 'domain'> = {}): void {
  setCookie(name, '', {
    ...options,
    maxAge: -1,
  })
}

/**
 * Check if a cookie exists
 */
export function hasCookie(name: string): boolean {
  return getCookie(name) !== null
}

// ============================================================================
// AUTH TOKEN MANAGEMENT (httpOnly - Server-Side Only)
// ============================================================================
// NOTE: Authentication tokens (accessToken, authToken, refreshToken) are now
// managed as httpOnly cookies by the backend for security (XSS protection).
// These cookies are NOT accessible via JavaScript and are automatically sent
// by the browser with each request.
//
// The functions below are DEPRECATED for auth token management but kept for
// backwards compatibility with any remaining non-auth cookie usage.
// ============================================================================

// Token-specific cookie names (for reference only - managed server-side)
export const TOKEN_COOKIE_NAMES = {
  AUTH_TOKEN: 'authToken',
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
} as const

/**
 * Clear all auth tokens
 * Note: This is now a no-op since auth tokens are httpOnly.
 * Call authAPI.logout() to properly clear authentication.
 */
export function clearAllAuthTokens(): void {
  // Clear any legacy non-httpOnly auth cookies if they exist
  // This helps with the migration from old system to new httpOnly system
  removeCookie(TOKEN_COOKIE_NAMES.AUTH_TOKEN)
  removeCookie(TOKEN_COOKIE_NAMES.ACCESS_TOKEN)
  removeCookie(TOKEN_COOKIE_NAMES.REFRESH_TOKEN)
}
