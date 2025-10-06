import type { User } from '../../entities/user'

/**
 * Response from authentication endpoints (login, register, OAuth)
 */
export interface AuthResponse {
  message: string
  accessToken: string
  idToken?: string
  refreshToken: string
  user?: User
}
