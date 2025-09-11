import { APIGatewayProxyEvent } from 'aws-lambda'
import { User } from '../users'
import { v4 } from 'uuid'
import { create } from '../../helpers/dynamo-helpers/create'
import { getUserByEmail } from '../../helpers/users/get-user-by-email'
import { Organization } from '../organizations'
import {
  checkRateLimit,
  getRateLimitKey
} from '../../helpers/rate-limiting/dynamo-rate-limiter'

interface CreateUserRequest {
  given_name: string
  family_name: string
  email: string
  address?: {
    line_1: string
    line_2?: string
    state: string
    city: string
    country: string
    postal_code: string
  }
  ip_address?: string
}

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 254
}

const validateName = (name: string): boolean => {
  return typeof name === 'string' && 
         name.trim().length > 0 && 
         name.length <= 100 &&
         /^[a-zA-Z\s'-]+$/.test(name)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const validateAddress = (address: any): address is NonNullable<CreateUserRequest['address']> => {
  if (!address || typeof address !== 'object') return false
  
  const required = [
    'line_1',
    'state',
    'city',
    'country',
    'postal_code'
  ]
  for (const field of required) {
    if (!address[field] || typeof address[field] !== 'string' || address[field].length === 0) {
      return false
    }
  }
  
  return address.line_1.length <= 200 &&
         address.state.length <= 100 &&
         address.city.length <= 100 &&
         address.country.length <= 2 && // ISO country code
         address.postal_code.length <= 20 &&
         (!address.line_2 || address.line_2.length <= 200)
}

const validateIpAddress = (ip: string): boolean => {
  const ipv4Regex = /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/
  const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/
  return ipv4Regex.test(ip) || ipv6Regex.test(ip)
}

export const publicCreateUser = async (event: APIGatewayProxyEvent) => {
  try {
    // Get client IP for rate limiting
    const clientIp = event.requestContext.identity.sourceIp || 
                     event.headers['X-Forwarded-For']?.split(',')[0]?.trim() ||
                     event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                     '0.0.0.0'

    // Rate limiting check
    const rateLimitKey = getRateLimitKey('public_user_creation', clientIp)
    const rateLimitResult = await checkRateLimit(rateLimitKey, {
      windowMs: 60 * 1000, // 1 minute window
      maxRequests: 5 // 5 requests per minute per IP
    })

    if (!rateLimitResult.allowed) {
      return {
        statusCode: 429,
        body: JSON.stringify({ 
          error: 'Too many requests. Please try again later.',
          resetTime: new Date(rateLimitResult.resetTime).toISOString()
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': Math.floor(rateLimitResult.resetTime / 1000).toString()
        }
      }
    }

    const body = JSON.parse(event.body || '{}') as CreateUserRequest

    // Validate required fields
    if (!body.given_name || !validateName(body.given_name)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'given_name is required and must be a valid name (letters, spaces, hyphens, apostrophes only, max 100 characters)' 
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    if (!body.family_name || !validateName(body.family_name)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'family_name is required and must be a valid name (letters, spaces, hyphens, apostrophes only, max 100 characters)' 
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    if (!body.email || !validateEmail(body.email)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'email is required and must be a valid email address' 
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    // Validate optional fields
    if (body.address && !validateAddress(body.address)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'address must include line_1, state, city, country (2-letter code), and postal_code' 
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    if (body.ip_address && !validateIpAddress(body.ip_address)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'ip_address must be a valid IPv4 or IPv6 address' 
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    // Check if user already exists
    const existingUser = await getUserByEmail(body.email)
    if (existingUser) {
      return {
        statusCode: 409,
        body: JSON.stringify({ 
          error: 'User with this email already exists' 
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    // Create new user
    const userId = v4()
    const organizationId = v4()
    
    const user: User = {
      id: userId,
      organization_id: organizationId,
      is_organization_admin: true,
      given_name: body.given_name.trim(),
      family_name: body.family_name.trim(),
      email: body.email.toLowerCase().trim(),
      address: body.address,
      ip_address: body.ip_address || clientIp
    }

    // Create user in DynamoDB
    const createdUser = await create<User>({
      tableName: process.env.USERS_TABLE!,
      key: { email: user.email },
      record: user,
      returnCreated: true
    })

    // Create organization for the user
    await create<Organization>({
      tableName: process.env.ORGANIZATIONS_TABLE!,
      key: { id: organizationId },
      record: {
        id: organizationId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } satisfies Organization,
      returnCreated: true
    })

    // Return only safe fields
    const safeUser = {
      id: createdUser.id,
      given_name: createdUser.given_name,
      family_name: createdUser.family_name,
      email: createdUser.email,
      address: createdUser.address,
      ip_address: createdUser.ip_address
    }

    return {
      statusCode: 201,
      body: JSON.stringify({ user: safeUser }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }

  } catch (error) {
    console.error('Error creating public user:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'User creation failed' 
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
}