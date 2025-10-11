import {
  organizationsTableName, paymentMethodsTableName, usersTableName
} from '@marketplace/constants'
import {
  Organization, PaymentMethod,
  User
} from '@marketplace/types'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { v4 } from 'uuid'
import { create } from '../../helpers/dynamo-helpers/create'
import { get } from '../../helpers/dynamo-helpers/get'
import { update } from '../../helpers/dynamo-helpers/update'
import {
  checkRateLimit,
  getRateLimitKey
} from '../../helpers/rate-limiting/dynamo-rate-limiter'
import { purchaseProducts } from '../../helpers/stripe/purchase-products'
import { getStripeClient } from '../../helpers/stripe/stripe-client'
import { convertAddressToCodes } from '../../helpers/tax/address-code-converter'
import { createUpdateUser } from '../../helpers/users/create-update-user'
import { getUserByEmail } from '../../helpers/users/get-user-by-email'

interface GuestCheckoutRequest {
  user: {
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
  paymentMethodCreateParams: {
    id: string
    last_four_digits: string
    brand: string
    expiry_month: string
    expiry_year: string
  }
  productKeys: Array<{
    id: string
    group_id: string
  }>
  promoCode?: string
  couponId?: string
}

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 254
}

const validateName = (name: string): boolean => {
  return typeof name === 'string' &&
         name.trim().length > 0 &&
         name.length <= 100 &&
         /^[a-zA-Z0-9\s'-]+$/.test(name)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const validateAddress = (address: any): address is NonNullable<GuestCheckoutRequest['user']['address']> => {
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

const validatePaymentMethodParams = (params: GuestCheckoutRequest['paymentMethodCreateParams']): boolean => {
  return !!(params.id && params.last_four_digits && params.brand && params.expiry_month && params.expiry_year)
}

export const guestCheckout = async (event: APIGatewayProxyEvent) => {
  try {
    // Get client IP for rate limiting
    const clientIp = event.requestContext.identity.sourceIp || 
                     event.headers['X-Forwarded-For']?.split(',')[0]?.trim() ||
                     event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                     '0.0.0.0'

    // Rate limiting check
    const rateLimitKey = getRateLimitKey('guest_checkout', clientIp)
    const rateLimitResult = await checkRateLimit(rateLimitKey, {
      windowMs: 60 * 1000, // 1 minute window
      maxRequests: 5 // 3 requests per minute per IP for checkout
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
          'X-RateLimit-Limit': '3',
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': Math.floor(rateLimitResult.resetTime / 1000).toString()
        }
      }
    }

    const body = JSON.parse(event.body || '{}') as GuestCheckoutRequest

    // Validate user data
    if (!body.user?.given_name || !validateName(body.user.given_name)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'user.given_name is required and must be a valid name (letters, spaces, hyphens, apostrophes only, max 100 characters)' 
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    if (!body.user?.family_name || !validateName(body.user.family_name)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'user.family_name is required and must be a valid name (letters, spaces, hyphens, apostrophes only, max 100 characters)' 
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    if (!body.user?.email || !validateEmail(body.user.email)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'user.email is required and must be a valid email address' 
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    // Convert and validate address if provided
    let processedAddress = body.user?.address
    if (body.user?.address) {
      if (!body.user.address.line_1 || !body.user.address.state || !body.user.address.city || !body.user.address.country || !body.user.address.postal_code) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: 'user.address must include line_1, state, city, country, and postal_code'
          }),
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true,
            'Content-Type': 'application/json'
          }
        }
      }

      // Convert country and state to proper codes
      const convertedCodes = convertAddressToCodes({
        country: body.user.address.country,
        state: body.user.address.state,
        city: body.user.address.city,
        postal_code: body.user.address.postal_code
      })

      processedAddress = {
        line_1: body.user.address.line_1,
        line_2: body.user.address.line_2,
        country: convertedCodes.country,
        state: convertedCodes.state,
        city: convertedCodes.city || body.user.address.city,
        postal_code: convertedCodes.postal_code || body.user.address.postal_code
      }

      // Final validation after conversion
      if (!validateAddress(processedAddress)) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: 'user.address validation failed after processing'
          }),
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true,
            'Content-Type': 'application/json'
          }
        }
      }
    }

    if (body.user?.ip_address && !validateIpAddress(body.user.ip_address)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'user.ip_address must be a valid IPv4 or IPv6 address' 
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    // Validate payment method params
    if (!validatePaymentMethodParams(body.paymentMethodCreateParams)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'paymentMethodCreateParams must include id, last_four_digits, brand, expiry_month, and expiry_year' 
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    // Validate product keys
    if (!body.productKeys || !Array.isArray(body.productKeys) || body.productKeys.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'productKeys is required and must be a non-empty array of products with id and group_id' 
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    for (const product of body.productKeys) {
      if (!product.id || !product.group_id) {
        return {
          statusCode: 400,
          body: JSON.stringify({ 
            error: 'Each product in productKeys must have both id and group_id' 
          }),
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true,
            'Content-Type': 'application/json'
          }
        }
      }
    }

    // Step 1: Create or get user
    let user: User
    const existingUser = await getUserByEmail(body.user.email)
    
    if (existingUser) {
      user = existingUser
    } else {
      // Create new user
      const userId = v4()
      const organizationId = v4()
      user = await createUpdateUser({
        id: userId,
        organization_id: organizationId,
        is_organization_admin: true,
        given_name: body.user.given_name.trim(),
        family_name: body.user.family_name.trim(),
        email: body.user.email.toLowerCase().trim(),
        address: processedAddress,
        ip_address: body.user.ip_address || clientIp
      })
    }

    // Step 2: Wait for Stripe customer to be created by DynamoDB stream
    // The users stream handler will automatically create the Stripe customer
    // We need to poll until the stripe_id is available
    const stripe = getStripeClient()
    let retryCount = 0
    const maxRetries = 10
    const retryDelayMs = 500
    
    while (!user.stripe_id && retryCount < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, retryDelayMs))
      
      // Refresh user data to check if stripe_id was set by the stream
      const updatedUser = await get<User>({
        tableName: usersTableName!,
        key: { id: user.id }
      })
      
      if (updatedUser?.stripe_id) {
        user = updatedUser
        break
      }
      
      retryCount++
    }

    if (!user.stripe_id) {
      throw new Error('Stripe customer creation timed out. Please try again.')
    }

    // Step 3: Create payment method
    const { 
      id: paymentMethodId, 
      last_four_digits, 
      brand, 
      expiry_month, 
      expiry_year 
    } = body.paymentMethodCreateParams

    const setupIntent = await stripe.setupIntents.create({
      customer: user.stripe_id,
      payment_method: paymentMethodId,
      confirm: true,
      usage: 'off_session',
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never'
      }
    })

    if (setupIntent.status !== 'succeeded') {
      throw new Error(`Setup intent failed with status: ${setupIntent.status}`)
    }

    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: user.stripe_id
    })

    await stripe.customers.update(user.stripe_id, {
      invoice_settings: {
        default_payment_method: paymentMethodId
      }
    })

    const paymentMethod = await create<PaymentMethod>({
      tableName: paymentMethodsTableName!,
      key: {
        user_id: user.id,
        id: paymentMethodId
      },
      record: {
        user_id: user.id,
        id: paymentMethodId,
        last_four_digits,
        brand,
        expiry_month: Number(expiry_month),
        expiry_year: Number(expiry_year)
      },
      returnCreated: true
    })

    // Update organization default payment method if not set
    const organization = await get<Organization>({
      tableName: organizationsTableName!,
      key: { id: user.organization_id }
    })

    if (organization && !organization.default_payment_method) {
      await update<Organization>({
        tableName: organizationsTableName!,
        key: { id: organization.id },
        updates: {
          default_payment_method: {
            id: paymentMethod.id,
            user_id: user.id
          }
        }
      })
    }

    // Step 4: Purchase products
    await purchaseProducts({
      userId: user.id,
      paymentMethodId: paymentMethod.id,
      productKeys: body.productKeys,
      promoCode: body.promoCode,
      couponId: body.couponId,
      ipAddress: clientIp
    })

    // Return success with safe user data
    const safeUser = {
      id: user.id,
      given_name: user.given_name,
      family_name: user.family_name,
      email: user.email,
      address: user.address
    }

    return {
      statusCode: 201,
      body: JSON.stringify({ 
        success: true,
        user: safeUser,
        message: 'Guest checkout completed successfully'
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }

  } catch (error) {
    console.error('Error in guest checkout:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Guest checkout failed',
        message: (error as Error).message
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
}