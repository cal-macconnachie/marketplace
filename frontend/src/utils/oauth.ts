import { domain } from '@marketplace/constants'
import type { CognitoConfig } from '@marketplace/types'

/**
 * Get Cognito configuration from environment variables
 */
export function getCognitoConfig(): CognitoConfig {
  // Use custom Cognito domain: auth.{env}.{domain} for dev, auth.{domain} for prod
  const cognitoDomain = `https://auth.${domain}`

  return {
    region: import.meta.env.VITE_COGNITO_REGION,
    userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
    clientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
    domain: cognitoDomain,
    redirectUri: `${window.location.origin}/auth/callback`,
  }
}

/**
 * Generate a random string for PKCE code verifier
 */
function generateRandomString(length: number): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const values = new Uint8Array(length)
  crypto.getRandomValues(values)
  return Array.from(values)
    .map((v) => charset[v % charset.length])
    .join('')
}

/**
 * Generate SHA-256 hash and base64url encode for PKCE code challenge
 */
async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(codeVerifier)
  const hash = await crypto.subtle.digest('SHA-256', data)

  // Convert to base64url
  const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/**
 * Generate and store PKCE code verifier, then return code challenge
 */
async function setupPKCE(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  const codeVerifier = generateRandomString(128)
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  // Store code verifier in sessionStorage for later use in callback
  sessionStorage.setItem('pkce_code_verifier', codeVerifier)

  return { codeVerifier, codeChallenge }
}

/**
 * Generate and store a random state parameter for CSRF protection
 */
function generateState(): string {
  const state = generateRandomString(32)
  sessionStorage.setItem('oauth_state', state)
  return state
}

/**
 * Build the Google OAuth authorization URL for Cognito Hosted UI
 */
export async function buildGoogleAuthUrl(): Promise<string> {
  const config = getCognitoConfig()
  const { codeChallenge } = await setupPKCE()
  const state = generateState()

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    identity_provider: 'Google',
    scope: 'openid email profile',
    state: state,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    prompt: 'select_account',
  })

  return `${config.domain}/oauth2/authorize?${params.toString()}`
}

/**
 * Redirect user to Google OAuth login via Cognito
 */
export async function redirectToGoogleAuth(): Promise<void> {
  const authUrl = await buildGoogleAuthUrl()
  window.location.href = authUrl
}

/**
 * Build the Apple OAuth authorization URL for Cognito Hosted UI
 */
export async function buildAppleAuthUrl(): Promise<string> {
  const config = getCognitoConfig()
  const { codeChallenge } = await setupPKCE()
  const state = generateState()

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    identity_provider: 'SignInWithApple',
    scope: 'openid email profile',
    state: state,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
  })

  return `${config.domain}/oauth2/authorize?${params.toString()}`
}

/**
 * Redirect user to Apple OAuth login via Cognito
 */
export async function redirectToAppleAuth(): Promise<void> {
  const authUrl = await buildAppleAuthUrl()
  window.location.href = authUrl
}

/**
 * Validate the state parameter from OAuth callback
 */
export function validateState(receivedState: string): boolean {
  const storedState = sessionStorage.getItem('oauth_state')
  sessionStorage.removeItem('oauth_state')
  return storedState === receivedState
}

/**
 * Get the stored PKCE code verifier
 */
export function getCodeVerifier(): string | null {
  const codeVerifier = sessionStorage.getItem('pkce_code_verifier')
  sessionStorage.removeItem('pkce_code_verifier')
  return codeVerifier
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string
  id_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}> {
  const config = getCognitoConfig()
  const codeVerifier = getCodeVerifier()

  if (!codeVerifier) {
    throw new Error('PKCE code verifier not found. Please restart the authentication flow.')
  }

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    code: code,
    redirect_uri: config.redirectUri,
    code_verifier: codeVerifier,
  })

  const response = await fetch(`${config.domain}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Token exchange failed: ${errorText}`)
  }

  return response.json()
}

/**
 * Redirect to Cognito logout endpoint
 * Use this when backend logout fails to ensure complete logout through Cognito
 */
export function redirectToCognitoLogout(logoutUri?: string): void {
  const config = getCognitoConfig()
  const logoutUrl = logoutUri || `${window.location.origin}/auth`

  const params = new URLSearchParams({
    client_id: config.clientId,
    logout_uri: logoutUrl,
  })

  window.location.href = `${config.domain}/logout?${params.toString()}`
}
