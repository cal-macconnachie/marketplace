/**
 * One-time password types
 * @internal Backend only
 */

export interface OneTimePassword {
  email: string
  type: string
  one_time_password: string
  expires_at: number
  created_at: string
}
