import { update } from '../dynamo-helpers/update'
import { get } from '../dynamo-helpers/get'

interface RateLimitRecord {
  key: string
  count: number
  window_start: number
  expires_at: number
}

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
}

export const checkRateLimit = async (
  key: string,
  config: RateLimitConfig = {
    windowMs: 60 * 1000, maxRequests: 5 
  }
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> => {
  const now = Date.now()
  const windowStart = Math.floor(now / config.windowMs) * config.windowMs
  const expiresAt = Math.floor((windowStart + config.windowMs * 2) / 1000) // TTL in seconds, keep for 2 windows
  
  try {
    // Try to get existing record
    const existing = await get<RateLimitRecord>({
      tableName: process.env.RATE_LIMITS_TABLE!,
      key: { key }
    })

    if (!existing || existing.window_start < windowStart) {
      // No existing record or it's from a previous window - create/update with count 1
      await update<RateLimitRecord>({
        tableName: process.env.RATE_LIMITS_TABLE!,
        key: { key },
        updates: {
          count: 1,
          window_start: windowStart,
          expires_at: expiresAt
        }
      })
      
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime: windowStart + config.windowMs
      }
    }

    // Record exists and is current
    if (existing.count >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: windowStart + config.windowMs
      }
    }

    // Increment the count
    const newCount = existing.count + 1
    await update<RateLimitRecord>({
      tableName: process.env.RATE_LIMITS_TABLE!,
      key: { key },
      updates: {
        count: newCount,
        expires_at: expiresAt
      }
    })

    return {
      allowed: true,
      remaining: config.maxRequests - newCount,
      resetTime: windowStart + config.windowMs
    }

  } catch (error) {
    console.error('Rate limiting error:', error)
    // On error, allow the request but log it
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: windowStart + config.windowMs
    }
  }
}

export const getRateLimitKey = (prefix: string, identifier: string): string => {
  return `${prefix}:${identifier}`
}