import router from '@/router'
import type {
  AuthResponse,
  ChangePasswordRequest,
  CreateConnectedAccountRequest,
  CreateConnectedAccountResponse,
  CreateMeterRequest,
  CreateMeterResponse,
  CreatePaymentMethodRequest,
  CreatePaymentMethodResponse,
  CreatePresignedUploadUrlRequest,
  CreatePresignedUploadUrlResponse,
  LoginRequest,
  OAuthLoginRequest,
  Organization,
  PaymentMethod,
  Product,
  Purchase,
  PurchasedProduct,
  // API types
  RegisterRequest,
  RequestRegisterOtpRequest,
  RequestResetPasswordRequest,
  ResetPasswordRequest,
  TaxCalculationRequest,
  TaxCalculationResult,
  // Entity types
  User
} from '@marketplace/types'
import { domain } from '@marketplace/constants'
import axios from 'axios'

// Determine environment - can be overridden via environment variable
const BASE_URL = import.meta.env.VITE_API_ENV === 'dev' ? `https://api.${import.meta.env.VITE_API_ENV}.${domain}` : `https://api.${domain}/`
const IMAGE_URL = import.meta.env.VITE_API_ENV === 'dev' ? `https://images.${import.meta.env.VITE_API_ENV}.${domain}` : `https://images.${domain}`

if (BASE_URL === 'unknown' || IMAGE_URL === 'unknown') {
  console.warn(
    'API base URL or Image service URL is not set. Please check your environment variables.',
  )
}

// Create axios instance with base configuration
const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false, // Ensure we don't send cookies that might cause CORS issues
})

const imageClient = axios.create({
  baseURL: IMAGE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false,
})

// Add request interceptor to include auth token if available
apiClient.interceptors.request.use((config) => {
  // Prefer access token; fall back to id token if present
  const accessToken = localStorage.getItem('accessToken')
  const idToken = localStorage.getItem('authToken')
  const token = idToken || accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor for handling token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config || {}
    const status = error?.response?.status

    // If we have no response, it may be a CORS/network error and we cannot read status
    if (status == null) {
      console.warn('API network/CORS error:', {
        url: originalRequest?.url,
        message: error?.message,
      })
      return Promise.reject(error)
    }

    if ((status === 401 || status === 403) && !originalRequest._retry) {
      originalRequest._retry = true // Mark the request as retried to avoid infinite loops.
      try {
        const refreshToken = localStorage.getItem('refreshToken') // Retrieve the stored refresh token.
        // Make a request to your auth server to refresh the token.
        if (refreshToken == null || refreshToken === '' || refreshToken === 'undefined')
          return Promise.reject(error)
        const refreshResponse = await axios.post(`${BASE_URL}/auth/refresh`, {
          refreshToken,
        })

        const { accessToken, refreshToken: newRefreshToken } = refreshResponse.data
        // Store the new access and refresh tokens.
        localStorage.setItem('accessToken', accessToken)
        localStorage.setItem('refreshToken', newRefreshToken)
        // Update the authorization header with the new access token.
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`
        return apiClient(originalRequest) // Retry the original request with the new access token.
      } catch (refreshError) {
        // Handle refresh token errors by clearing stored tokens and redirecting to the login page.
        console.error('Token refresh failed:', refreshError)
        localStorage.removeItem('authToken')
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        router.push('/auth')
        return Promise.reject(error)
      }
    }
    return Promise.reject(error) // For all other errors, return the error as is.
  },
)

// Auth API functions
export const authAPI = {
  async requestRegisterOtp(data: RequestRegisterOtpRequest): Promise<{ message?: string }> {
    const response = await apiClient.post('/auth/request-register-otp', data)
    return response.data
  },

  async register(data: RegisterRequest): Promise<void> {
    try {
      await apiClient.post('/auth/register', data)
      // Registration just returns 200 on success, no auth tokens
    } catch (error: unknown) {
      console.error('Register error:', error)
      throw error
    }
  },

  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await apiClient.post('/auth/login', data)
    return response.data
  },

  async oauthLogin(data: OAuthLoginRequest): Promise<AuthResponse> {
    const response = await apiClient.post('/auth/login', data)
    return response.data
  },

  async refresh(
    refreshToken: string,
  ): Promise<{ accessToken: string; idToken?: string; refreshToken?: string }> {
    if (!refreshToken || refreshToken === 'undefined') {
      return Promise.reject(new Error('No refresh token available'))
    }
    const response = await apiClient.post('/auth/refresh', { refreshToken })
    return response.data
  },

  async logout(
    accessToken: string,
    token: string,
    refreshToken: string,
  ): Promise<{ redirectUrl?: string; requiresRedirect?: boolean } | void> {
    const response = await apiClient.post(
      '/auth/logout',
      { accessToken, refreshToken },
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    return response.data
  },

  async changePassword(data: ChangePasswordRequest): Promise<void> {
    await apiClient.post('/auth/change-password', data)
  },

  async requestResetPassword(data: RequestResetPasswordRequest): Promise<{ message?: string }> {
    const response = await apiClient.post('/auth/request-reset-password', data)
    return response.data
  },

  async resetPassword(data: ResetPasswordRequest): Promise<{ message?: string }> {
    const response = await apiClient.post('/auth/reset-password', data)
    return response.data
  },

  async getCurrentUser(): Promise<User> {
    // First try to get cognito_id from stored user data
    const storedUserData = localStorage.getItem('userData')
    let cognitoId: string | undefined

    if (storedUserData) {
      try {
        const userData = JSON.parse(storedUserData)
        cognitoId = userData.cognito_id
      } catch {
        console.error('Failed to parse stored user data, will try JWT')
      }
    }

    // If no cognito_id from stored data, extract from JWT
    if (!cognitoId) {
      const token = localStorage.getItem('authToken')
      if (!token) throw new Error('No auth token found')

      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        cognitoId = payload.sub || payload.username
      } catch {
        throw new Error('Failed to decode JWT token')
      }
    }

    if (!cognitoId) {
      throw new Error('No cognito_id found to fetch user data')
    }

    const response = await apiClient.post('/get-users', { cognito_id: cognitoId })

    return response.data[0]
  },

  async getOrganization(id: string): Promise<Organization> {
    const response = await apiClient.post('/get-organization', { id })
    return response.data
  },

  async updateOrganization(orgData: Partial<Organization> & { id: string }): Promise<Organization> {
    const response = await apiClient.post('/update-organization', orgData)
    return response.data
  },

  async updateUser(userData: Partial<User> & { id: string }): Promise<User> {
    const response = await apiClient.post('/update-user', userData)
    return response.data
  },

  async createPaymentMethod(
    data: CreatePaymentMethodRequest,
  ): Promise<CreatePaymentMethodResponse> {
    const response = await apiClient.post('/create-payment-method', data)
    return response.data
  },

  async getPaymentMethods(userId: string): Promise<PaymentMethod[]> {
    const response = await apiClient.post(`/get-payment-methods`, {
      user_id: userId,
    })
    return response.data
  },

  async getProducts(groupId: string): Promise<Product[]> {
    const response = await apiClient.post(`/get-products`, { group_id: groupId })
    return response.data
  },

  async getPurchases({
    purchase,
    lastEvaluatedKey,
    type = 'read',
    limit = 10,
  }: {
    purchase: Partial<Purchase>
    lastEvaluatedKey?: Record<string, unknown>
    type?: 'read' | 'update'
    limit?: number
  }): Promise<
    | {
        items: Purchase[]
        lastEvaluatedKey?: Record<string, unknown>
      }
    | Purchase
    | undefined
  > {
    const data = {
      purchase,
      type,
      lastEvaluatedKey,
      limit,
    }
    const response = await apiClient.post(`/purchases`, data)
    return response.data
  },

  async archivePaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
    await apiClient.post('/archive-payment-method', {
      user_id: userId,
      id: paymentMethodId,
    })
  },

  async cancelSubscription(subscriptionIds: Record<string, string>, userId: string): Promise<void> {
    await apiClient.post('/cancel-subscription', {
      subscription_ids: subscriptionIds,
      user_id: userId,
    })
  },

  async cancelSubscriptionItem(
    userId: string,
    subscriptionId: string,
    purchasedProduct?: PurchasedProduct,
  ): Promise<void> {
    await apiClient.post('/cancel-subscription', {
      user_id: userId,
      subscription_id: subscriptionId,
      purchased_product: purchasedProduct,
    })
  },

  async createConnectedAccount(
    data: CreateConnectedAccountRequest,
  ): Promise<CreateConnectedAccountResponse> {
    const response = await apiClient.post('/stripe/create-connected-account', data)
    return response.data
  },

  async refreshStripeAccount({
    organizationId,
    refreshUrl,
    returnUrl,
  }: {
    organizationId: string
    refreshUrl: string
    returnUrl: string
  }): Promise<string> {
    const res = await apiClient.post('/stripe/refresh-connect-url', {
      organization_id: organizationId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
    })
    return res.data.url
  },

  async createExpressLoginLink(): Promise<{ login_url: string }> {
    const response = await apiClient.post('/stripe/express-login-link')
    return response.data
  },

  async createMeter(data: CreateMeterRequest): Promise<CreateMeterResponse> {
    const response = await apiClient.post('/meters', data)
    return response.data
  },

  async testStatusCode(code: number) {
    const res = await apiClient.post(`/test-status-codes/${code}`)
    return res.data
  },

  async createPresignedUploadUrl(
    data: CreatePresignedUploadUrlRequest,
  ): Promise<CreatePresignedUploadUrlResponse> {
    const response = await apiClient.post('/images/presigned-upload', {
      fileName: data.filename,
      fileType: data.contentType,
    })
    return response.data
  },

  async uploadImageToS3(uploadUrl: string, file: File) {
    return await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    })
  },

  async uploadImages(files: FileList): Promise<string[]> {
    const uploadPromises = Array.from(files).map(async (file) => {
      // Get presigned URL
      const presignedData = await this.createPresignedUploadUrl({
        filename: file.name,
        contentType: file.type,
      })

      // Upload to S3
      await this.uploadImageToS3(presignedData.uploadUrl, file)

      // Return the key which can be used to construct the public URL
      return presignedData.key
    })

    return Promise.all(uploadPromises)
  },

  async purchaseProducts(data: {
    userId: string
    paymentMethodId: string
    productKeys: Array<{
      id: string
      group_id: string
    }>
    promoCode?: string
    couponId?: string
  }): Promise<void> {
    await apiClient.post('/purchase-products', data)
  },

  async getPurchasedProducts({
    organization_id,
    user_id,
    id,
    subscription_id,
    limit,
    last_evaluated_key,
    sort_order,
  }: {
    organization_id?: string
    user_id?: string
    id?: string
    subscription_id?: string
    limit?: number
    last_evaluated_key?: Record<string, unknown>
    sort_order?: 'asc' | 'desc'
  }): Promise<PurchasedProduct[]> {
    const response = await apiClient.post('/organizations/purchased-products', {
      organization_id,
      user_id,
      id,
      subscription_id,
      limit,
      last_evaluated_key,
      sort_order,
    })
    return response.data
  },

  async logMeterEvent(data: {
    purchase_id: string
    user_id: string
    value: number
    metadata?: Record<string, unknown>
  }): Promise<void> {
    await apiClient.post('/stripe/log-meter-event', data)
  },
}

export const publicApi = {
  async getPublicProduct(groupId: string, id: string): Promise<Product> {
    const response = await apiClient.get(`/public/products/${groupId}/${id}`)
    return response.data
  },

  async getPublicOrganization(id: string): Promise<Organization> {
    const response = await apiClient.get(`/public/organizations/${id}`)
    return response.data
  },

  async getImage(key: string): Promise<Blob> {
    const response = await imageClient.get(`/images/${key}`, {
      responseType: 'blob',
    })
    return response.data
  },

  async calculateTaxes(data: TaxCalculationRequest): Promise<TaxCalculationResult> {
    const response = await apiClient.post('/calculate-taxes', data)
    return response.data
  },

  async guestCheckout(data: {
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
  }): Promise<void> {
    await apiClient.post('/guest-checkout', data)
  },

  async fetchPublicProducts({
    exclusiveStartKey,
    limit,
  }: {
    exclusiveStartKey?: { [key: string]: string }
    limit?: number
  }): Promise<{
    message: string
    items: Product[]
    lastEvaluatedKey?: { [key: string]: string }
  }> {
    const response = await apiClient.post('/public/products', {
      exclusiveStartKey,
      limit,
    })
    return response.data
  },
}

export { apiClient, imageClient }
