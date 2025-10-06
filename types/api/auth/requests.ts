/**
 * Request to register a new user account
 */
export interface RegisterRequest {
  email: string
  password: string
  given_name?: string
  family_name?: string
  code: string
}

/**
 * Request to send registration OTP code
 */
export interface RequestRegisterOtpRequest {
  email: string
}

/**
 * Request to login with email and password
 */
export interface LoginRequest {
  email: string
  password: string
}

/**
 * Request to login via OAuth provider
 */
export interface OAuthLoginRequest {
  accessToken: string
  idToken: string
  refreshToken: string
}

/**
 * Request to change password
 */
export interface ChangePasswordRequest {
  oldPassword: string
  newPassword: string
}

/**
 * Request to initiate password reset
 */
export interface RequestResetPasswordRequest {
  email: string
}

/**
 * Request to complete password reset with OTP
 */
export interface ResetPasswordRequest {
  email: string
  newPassword: string
  otp: string
}
