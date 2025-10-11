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

// Token-specific cookie names
export const TOKEN_COOKIE_NAMES = {
  AUTH_TOKEN: 'authToken',
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
} as const

// Default cookie options for auth tokens
const AUTH_TOKEN_OPTIONS: CookieOptions = {
  maxAge: 60 * 60 * 24 * 7, // 7 days
  secure: true,
  sameSite: 'lax',
  path: '/',
}

/**
 * Set an auth token in a secure cookie
 */
export function setAuthToken(name: keyof typeof TOKEN_COOKIE_NAMES, value: string): void {
  setCookie(TOKEN_COOKIE_NAMES[name], value, AUTH_TOKEN_OPTIONS)
}

/**
 * Get an auth token from cookies
 */
export function getAuthToken(name: keyof typeof TOKEN_COOKIE_NAMES): string | null {
  return getCookie(TOKEN_COOKIE_NAMES[name])
}

/**
 * Remove an auth token cookie
 */
export function removeAuthToken(name: keyof typeof TOKEN_COOKIE_NAMES): void {
  removeCookie(TOKEN_COOKIE_NAMES[name])
}

/**
 * Clear all auth tokens
 */
export function clearAllAuthTokens(): void {
  removeAuthToken('AUTH_TOKEN')
  removeAuthToken('ACCESS_TOKEN')
  removeAuthToken('REFRESH_TOKEN')
}
