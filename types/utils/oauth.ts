/**
 * OAuth utility types for Google and Apple authentication via AWS Cognito
 */

/**
 * Cognito configuration for OAuth flows
 */
export interface CognitoConfig {
  region: string
  userPoolId: string
  clientId: string
  domain: string
  redirectUri: string
}

/**
 * PKCE (Proof Key for Code Exchange) parameters
 */
export interface PKCEParams {
  codeVerifier: string
  codeChallenge: string
}

/**
 * OAuth token response from Cognito token endpoint
 */
export interface OAuthTokenResponse {
  access_token: string
  id_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

/**
 * OAuth authorization parameters for Cognito Hosted UI
 */
export interface OAuthAuthorizationParams {
  response_type: 'code'
  client_id: string
  redirect_uri: string
  identity_provider: 'Google' | 'SignInWithApple'
  scope: string
  state: string
  code_challenge_method: 'S256'
  code_challenge: string
  prompt?: 'select_account' | 'login' | 'consent' | 'none'
}

/**
 * OAuth token exchange parameters
 */
export interface OAuthTokenExchangeParams {
  grant_type: 'authorization_code'
  client_id: string
  code: string
  redirect_uri: string
  code_verifier: string
}

/**
 * OAuth logout parameters for Cognito
 */
export interface OAuthLogoutParams {
  client_id: string
  logout_uri: string
}

/**
 * OAuth callback query parameters
 */
export interface OAuthCallbackParams {
  code?: string
  state?: string
  error?: string
  error_description?: string
}
