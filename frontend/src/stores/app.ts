// Utilities
import { defineStore } from 'pinia'
import {
  authAPI,
  publicApi,
  apiClient
} from '@/services/api'
import { dedupedConcatInPlace } from '@/utils/dedupedConcatInPlace'
import type { AuthResponse, CreatePaymentMethodRequest, LoginRequest, Organization, PaymentMethod, Product, Purchase, PurchasedProduct, RegisterRequest, TaxCalculationRequest, TaxCalculationResult, User } from '@marketplace/types'
interface ProductFormData {
  key?: {
    group_id: string
    id: string
  }
  type: 'one_time' | 'recurring' | ''
  name: string
  description: string
  category: string
  price: number
  is_public: boolean
  usageType: 'licensed' | 'metered'
  billingPeriod: {
    interval: 'month' | 'day' | 'week' | 'year'
    intervalCount: number
  }
  meterConfig: {
    displayName: string
    unit: string
    eventName: string
    aggregationFormula: 'count' | 'sum'
  }
  images: string[]
  marketingFeatures: { name: string }[]
  error?: string
}

export const useAppStore = defineStore('app', {
  state: () => ({
    user: null as User | null,
    userPurchases: [] as Array<Purchase>,
    userPurchasesLastKey: undefined as Record<string, unknown> | undefined,
    organizationPurchases: [] as Array<Purchase>,
    organizationPurchasesLastKey: undefined as Record<string, unknown> | undefined,
    organization: null as Organization | null,
    isAuthenticated: false,
    isLoading: false,
    error: null as string | null,
    paymentMethods: [] as Array<PaymentMethod>,
    paymentMethodsLoading: false,
    organizationProducts: [] as Array<Product>,
    purchasedProducts: [] as Array<PurchasedProduct>,
    subscriptionPurchasedProducts: [] as Array<PurchasedProduct>,
    organizationProductsLoading: false,
    purchasedProductsLoading: false,
    taxCalculation: null as TaxCalculationResult | null,
    taxLoading: false,
    productFormData: {
      type: '',
      name: '',
      description: '',
      category: '',
      price: 0,
      is_public: false,
      usageType: 'licensed',
      billingPeriod: {
        interval: 'month',
        intervalCount: 1,
      },
      meterConfig: {
        displayName: '',
        unit: '',
        eventName: '',
        aggregationFormula: 'count',
      },
      images: [],
      marketingFeatures: [],
    } as ProductFormData,
    productFormToggleStates: {
      showImages: false,
      showMarketingFeatures: false,
      requiresShipping: false,
    },
  }),

  getters: {
    fullName: (state) => {
      if (!state.user) return ''
      // Use name if available, otherwise combine given_name and family_name, fallback to email
      if (state.user.name) return state.user.name
      const fullName = `${state.user.given_name || ''} ${state.user.family_name || ''}`.trim()
      return fullName || state.user.email || 'User'
    },
    hasSubscription: (state) => {
      return (Object.keys(state.organization?.stripe_subscription_ids ?? {}).length ?? 0) > 0
    },
    hasPaymentMethods: (state) => {
      return (state.paymentMethods.length ?? 0) > 0
    },
    hasPurchased: (state) => {
      return (state.userPurchases.length ?? 0) > 0 || (state.paymentMethods.length ?? 0) > 0
    },
  },

  actions: {
    setLoading(loading: boolean) {
      this.isLoading = loading
      if (loading) this.error = null
    },

    setError(error: string) {
      this.error = error
      this.isLoading = false
    },

    setAuth(response: AuthResponse) {
      this.isAuthenticated = true
      this.isLoading = false
      this.error = null

      // Store tokens in localStorage - use ID token if available, otherwise access token
      if (response.idToken) localStorage.setItem('authToken', response.idToken)
      if (response.accessToken) localStorage.setItem('accessToken', response.accessToken)
      if (response.refreshToken) localStorage.setItem('refreshToken', response.refreshToken)

      // Store user data if provided
      if (response.user) {
        this.user = response.user
        localStorage.setItem('userData', JSON.stringify(response.user))
      }
    },

    async fetchCurrentUser() {
      try {
        const user = await authAPI.getCurrentUser()
        this.user = user
        return { success: true }
      } catch (error: unknown) {
        console.error('Failed to fetch user:', error)
        // If we can't fetch user data, clear auth
        this.clearAuth()
        return { success: false, error: (error as { message?: string }).message }
      }
    },

    async fetchOrganization() {
      try {
        if (!this.user?.organization_id) {
          return
        }
        const organization = await authAPI.getOrganization(this.user.organization_id)
        this.organization = organization
        return { success: true }
      } catch (error: unknown) {
        console.error('Failed to fetch organization:', error)
        return { success: false, error: (error as { message?: string }).message }
      }
    },

    async getPaymentMethods(userId: string) {
      this.paymentMethodsLoading = true
      try {
        const paymentMethods = await authAPI.getPaymentMethods(userId)
        this.paymentMethods = this.paymentMethods.concat(paymentMethods).reduce((acc, curr) => {
          const existing = acc.find((item) => item.id === curr.id)
          if (!existing) {
            acc.push(curr)
          }
          return acc
        }, [] as Array<PaymentMethod>)
        return paymentMethods
      } catch (error: unknown) {
        console.error('Failed to fetch payment methods:', error)
      } finally {
        this.paymentMethodsLoading = false
      }
    },

    async getProducts(groupId: string) {
      try {
        const products = await authAPI.getProducts(groupId)
        return products
      } catch (error: unknown) {
        console.error('Failed to fetch products:', error)
      }
    },

    async getUserPurchases(limit: number = 10) {
      try {
        if (this.user == null) return 0
        const purchasesResponse = await authAPI.getPurchases({
          purchase: { user_id: this.user?.id },
          lastEvaluatedKey: this.userPurchasesLastKey,
          limit,
        })
        let items: Purchase[] = []
        if (
          purchasesResponse &&
          'items' in purchasesResponse &&
          Array.isArray(purchasesResponse.items)
        ) {
          items = purchasesResponse.items
          this.userPurchasesLastKey = purchasesResponse.lastEvaluatedKey
        } else if (purchasesResponse && !('items' in purchasesResponse)) {
          items = [purchasesResponse as Purchase]
        } else {
          console.error('Invalid purchases response:', purchasesResponse)
          return 0
        }
        // add in new purchases to end of array and any matching ones replace in location
        this.userPurchases = dedupedConcatInPlace({
          old: this.userPurchases,
          next: items,
        }).sort((a, b) => new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime())
        return items.length
      } catch (error: unknown) {
        console.error('Failed to fetch purchases:', error)
        return 0
      }
    },

    async getOrganizationPurchases(limit: number = 10) {
      try {
        if (!this.organization?.id) return 0
        const purchasesResponse = await authAPI.getPurchases({
          purchase: { organization_id: this.organization.id },
          lastEvaluatedKey: this.organizationPurchasesLastKey,
          limit,
        })
        let items: Purchase[] = []
        if (
          purchasesResponse &&
          'items' in purchasesResponse &&
          Array.isArray(purchasesResponse.items)
        ) {
          items = purchasesResponse.items
          this.organizationPurchasesLastKey = purchasesResponse.lastEvaluatedKey
        } else if (purchasesResponse && !('items' in purchasesResponse)) {
          // purchasesResponse is a single Purchase object
          items = [purchasesResponse as Purchase]
        } else {
          console.error('Invalid purchases response:', purchasesResponse)
          return 0
        }
        this.organizationPurchases = dedupedConcatInPlace({
          old: this.organizationPurchases,
          next: items,
        }).sort((a, b) => new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime())
        return items.length
      } catch (error: unknown) {
        console.error('Failed to fetch organization purchases:', error)
        return 0
      }
    },

    async getSellerOrganizationPurchases(limit: number = 10) {
      try {
        if (!this.organization?.id) return 0
        const purchasesResponse = await authAPI.getPurchases({
          purchase: { seller_organization_id: this.organization.id },
          lastEvaluatedKey: this.organizationPurchasesLastKey,
          limit,
        })
        let items: Purchase[] = []
        if (
          purchasesResponse &&
          'items' in purchasesResponse &&
          Array.isArray(purchasesResponse.items)
        ) {
          items = purchasesResponse.items
          this.organizationPurchasesLastKey = purchasesResponse.lastEvaluatedKey
        } else if (purchasesResponse && !('items' in purchasesResponse)) {
          // purchasesResponse is a single Purchase object
          items = [purchasesResponse as Purchase]
        } else {
          console.error('Invalid purchases response:', purchasesResponse)
          return 0
        }
        this.organizationPurchases = dedupedConcatInPlace({
          old: this.organizationPurchases,
          next: items,
        }).sort((a, b) => new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime())
        return items.length
      } catch (error: unknown) {
        console.error('Failed to fetch organization purchases:', error)
        return 0
      }
    },

    updateUserPurchase(updatedPurchase: Purchase) {
      const index = this.userPurchases.findIndex((p) => p.id === updatedPurchase.id)
      if (index !== -1) {
        this.userPurchases[index] = updatedPurchase
      }
    },

    updateOrganizationPurchase(updatedPurchase: Purchase) {
      const index = this.organizationPurchases.findIndex((p) => p.id === updatedPurchase.id)
      if (index !== -1) {
        this.organizationPurchases[index] = updatedPurchase
      }
    },

    clearAuth() {
      this.user = null
      this.isAuthenticated = false
      this.isLoading = false
      this.error = null

      // Remove tokens and user data from localStorage
      localStorage.removeItem('authToken')
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('userData')
    },

    clearAllStoreData() {
      // Clear all purchases
      this.userPurchases = []
      this.userPurchasesLastKey = undefined
      this.organizationPurchases = []
      this.organizationPurchasesLastKey = undefined

      // Clear organization data
      this.organization = null

      // Clear payment methods
      this.paymentMethods = []
      this.paymentMethodsLoading = false

      // Clear products
      this.organizationProducts = []
      this.purchasedProducts = []
      this.subscriptionPurchasedProducts = []
      this.organizationProductsLoading = false
      this.purchasedProductsLoading = false

      // Clear tax calculation
      this.taxCalculation = null
      this.taxLoading = false

      // Clear product form data
      this.clearProductFormData()
    },

    async requestRegisterOtp(email: string) {
      try {
        this.setLoading(true)
        await authAPI.requestRegisterOtp({ email })
        this.isLoading = false
        return { success: true }
      } catch (error: unknown) {
        const errorMessage =
          (error as { response?: { data?: { message?: string } } }).response?.data?.message ||
          'Failed to request registration code'
        this.setError(errorMessage)
        return { success: false, error: errorMessage }
      }
    },

    async register(userData: RegisterRequest) {
      try {
        this.setLoading(true)

        // Step 1: Register the user (returns 200 on success)
        await authAPI.register(userData)

        // Step 2: Login the user with their credentials to get tokens
        const loginResponse = await authAPI.login({
          email: userData.email,
          password: userData.password,
        })

        // Set auth data from login response
        this.setAuth(loginResponse)

        // Fetch user data if not provided in auth response
        if (!loginResponse.user) {
          await this.fetchCurrentUser()
        }

        return { success: true }
      } catch (error: unknown) {
        const errorMessage =
          (error as { response?: { data?: { message?: string } } }).response?.data?.message ||
          'Registration failed'
        this.setError(errorMessage)
        return { success: false, error: errorMessage }
      }
    },

    async login(credentials: LoginRequest) {
      try {
        this.setLoading(true)
        const response = await authAPI.login(credentials)
        this.setAuth(response)

        // Fetch user data if '' in auth response
        if (!response.user) {
          await this.fetchCurrentUser()
        }

        return { success: true }
      } catch (error: unknown) {
        const errorMessage =
          (error as { response?: { data?: { message?: string } } }).response?.data?.message ||
          (error as { response?: { data?: { error?: string } } }).response?.data?.error ||
          'Login failed'
        this.setError(errorMessage)
        return { success: false, error: errorMessage }
      }
    },

    async logout() {
      try {
        this.setLoading(true)
        const accessToken = localStorage.getItem('accessToken')
        const refreshToken = localStorage.getItem('refreshToken') ?? ''
        const token = localStorage.getItem('authToken')

        // Make logout API call if token exists
        if (accessToken && token) {
          const response = await authAPI.logout(accessToken, token, refreshToken)
          // If backend returns a redirect URL, clear auth then redirect to Cognito
          if (response && typeof response === 'object' && 'requiresRedirect' in response && response.requiresRedirect && response.redirectUrl) {
            // Clear local auth before redirecting
            this.clearAuth()
            this.clearAllStoreData()
            window.location.href = response.redirectUrl
            return { success: true }
          }
        }

        // Clear auth for non-OAuth users or after successful logout
        this.clearAuth()
        this.clearAllStoreData()

        return { success: true }
      } catch (error: unknown) {
        // Ensure auth is cleared even if there's an unexpected error
        this.clearAuth()
        this.clearAllStoreData()
        return { success: false, error: (error as { message?: string }).message }
      }
    },

    async changePassword(oldPassword: string, newPassword: string) {
      try {
        this.setLoading(true)
        await authAPI.changePassword({ oldPassword, newPassword })
        this.isLoading = false
        return { success: true }
      } catch (error: unknown) {
        const errorMessage =
          (error as { response?: { data?: { message?: string } } }).response?.data?.message ||
          'Password change failed'
        this.setError(errorMessage)
        return { success: false, error: errorMessage }
      }
    },

    async updateUser(userData: Partial<User>) {
      if (!this.user?.id) {
        return { success: false, error: 'User ID not found' }
      }

      try {
        const updatedUser = await authAPI.updateUser({ ...userData, id: this.user.id })
        this.user = updatedUser
        localStorage.setItem('userData', JSON.stringify(updatedUser))
        return { success: true }
      } catch (error: unknown) {
        const errorMessage =
          (error as { response?: { data?: { message?: string } } }).response?.data?.message ||
          'Failed to update user'
        return { success: false, error: errorMessage }
      }
    },

    async createPaymentMethod(paymentMethodData: Omit<CreatePaymentMethodRequest, 'user_id'>) {
      if (!this.user?.id) {
        return { success: false, error: 'User ID not found' }
      }

      try {
        await authAPI.createPaymentMethod({
          ...paymentMethodData,
          user_id: this.user.id,
        })
        return { success: true }
      } catch (error: unknown) {
        const errorMessage =
          (error as { response?: { data?: { message?: string } } }).response?.data?.message ||
          'Failed to create payment method'
        return { success: false, error: errorMessage }
      }
    },

    async cancelSubscription() {
      if (!this.user?.id) {
        return { success: false, error: 'User ID not found' }
      }

      try {
        if (
          this.organization?.stripe_subscription_ids == null ||
          Object.keys(this.organization.stripe_subscription_ids).length === 0
        ) {
          return { success: false, error: 'No subscriptions found' }
        }
        await authAPI.cancelSubscription(this.organization.stripe_subscription_ids, this.user.id)
        return { success: true }
      } catch (error: unknown) {
        const errorMessage =
          (error as { response?: { data?: { message?: string } } }).response?.data?.message ||
          'Failed to cancel subscriptions'
        return { success: false, error: errorMessage }
      }
    },

    // Check if user is already authenticated (on app startup)
    async initializeAuth() {
      const token = localStorage.getItem('authToken')
      const refreshToken = localStorage.getItem('refreshToken')
      const userData = localStorage.getItem('userData')

      if (token && refreshToken) {
        this.isAuthenticated = true

        // Fast load from stored data first
        if (userData) {
          try {
            this.user = JSON.parse(userData)
          } catch {
            console.error('Failed to parse stored user data')
          }
        }

        // Then refetch fresh data to ensure it's up-to-date
        try {
          await this.fetchCurrentUser()
          await this.fetchOrganization()
        } catch {
          console.error('Failed to refresh user data, using stored data')
        }
      }
    },
    async refreshStripeAccount({
      organizationId,
      refreshUrl,
      returnUrl,
    }: {
      organizationId: string
      refreshUrl: string
      returnUrl: string
    }) {
      try {
        return await authAPI.refreshStripeAccount({
          organizationId,
          refreshUrl,
          returnUrl,
        })
      } catch (error: unknown) {
        console.error('Failed to refresh Stripe account', error)
      }
    },

    setProductFormData(data: {
      type: string
      name: string
      description: string
      category: string
      price: number
      is_public?: boolean
      key?: {
        group_id: string
        id: string
      }
      usageType?: 'licensed' | 'metered'
      billingPeriod?: {
        interval: 'day' | 'week' | 'month' | 'year'
        intervalCount: number
      }
      meterConfig?: {
        displayName: string
        unit: string
        eventName: string
        aggregationFormula: 'count' | 'sum'
      }
      images?: string[]
      marketingFeatures?: { name: string }[]
      error?: string
    }) {
      this.productFormData = {
        ...data,
        type: data.type === 'one_time' ? 'one_time' : 'recurring',
        is_public: data.is_public ?? false,
        usageType: data.usageType || 'licensed',
        billingPeriod: data.billingPeriod || {
          interval: 'month' as 'day' | 'week' | 'month' | 'year',
          intervalCount: 1,
        },
        meterConfig: data.meterConfig || {
          displayName: '',
          unit: '',
          eventName: '',
          aggregationFormula: 'count' as 'count' | 'sum',
        },
        images: data.images || [],
        marketingFeatures: data.marketingFeatures || [],
        error: data.error,
      }
    },

    updateProductFormField(
      field: keyof typeof this.productFormData,
      value: string | number | boolean,
    ) {
      // @ts-expect-error dumb
      this.productFormData[field] = value
    },

    clearProductFormData() {
      this.productFormData = {
        type: '',
        name: '',
        description: '',
        category: '',
        price: 0,
        is_public: false,
        usageType: 'licensed',
        billingPeriod: {
          interval: 'month',
          intervalCount: 1,
        },
        meterConfig: {
          displayName: '',
          unit: '',
          eventName: '',
          aggregationFormula: 'count',
        },
        images: [],
        marketingFeatures: [],
      }
      // Also clear toggle states
      this.productFormToggleStates.showImages = false
      this.productFormToggleStates.showMarketingFeatures = false
      this.productFormToggleStates.requiresShipping = false
      this.productFormData.error = undefined
      this.productFormData.key = undefined
    },

    setProductFormToggleState(
      field: 'showImages' | 'showMarketingFeatures' | 'requiresShipping',
      value: boolean,
    ) {
      this.productFormToggleStates[field] = value
    },

    async calculateTaxes(data: TaxCalculationRequest) {
      try {
        this.taxLoading = true
        const taxResult = await publicApi.calculateTaxes(data)
        this.taxCalculation = taxResult
        return { success: true, data: taxResult }
      } catch (error: unknown) {
        console.error('Failed to calculate taxes:', error)
        const errorMessage =
          (error as { response?: { data?: { error?: string } } }).response?.data?.error ||
          'Failed to calculate taxes'
        return { success: false, error: errorMessage }
      } finally {
        this.taxLoading = false
      }
    },

    clearTaxCalculation() {
      this.taxCalculation = null
      this.taxLoading = false
    },

    async fetchOrganizationProducts() {
      try {
        if (this.organizationProducts.length === 0) {
          this.organizationProductsLoading = true
        }
        if (this.user?.organization_id == null) {
          this.organizationProductsLoading = false
          return
        }
        const response = await apiClient.get(
          `/products?organization_id=${this.user?.organization_id}`,
        )
        if (response.status === 200) {
          this.organizationProducts = [...response.data]
        }
      } catch (error) {
        console.error('Error fetching organization products:', error)
      } finally {
        this.organizationProductsLoading = false
      }
    },

    clearOrganizationProducts() {
      this.organizationProducts = []
    },

    async fetchPurchasedProducts(filters?: {
      organization_id?: string
      user_id?: string
      subscription_id?: string
      limit?: number
    }) {
      try {
        this.purchasedProductsLoading = true
        const products = await authAPI.getPurchasedProducts({
          organization_id: filters?.organization_id,
          user_id: filters?.user_id,
          subscription_id: filters?.subscription_id,
          limit: filters?.limit,
        })
        this.purchasedProducts = products
        return { success: true, data: products }
      } catch (error: unknown) {
        console.error('Failed to fetch purchased products:', error)
        const errorMessage =
          (error as { response?: { data?: { message?: string } } }).response?.data?.message ||
          'Failed to fetch purchased products'
        return { success: false, error: errorMessage }
      } finally {
        this.purchasedProductsLoading = false
      }
    },

    async fetchSubscriptionPurchasedProducts() {
      try {
        this.purchasedProductsLoading = true
        if (!this.user?.id) {
          return { success: false, error: 'User ID not found' }
        }
        const promises = []
        for (const subscriptionId of Object.values(
          this.organization?.stripe_subscription_ids ?? {},
        )) {
          promises.push(
            authAPI.getPurchasedProducts({
              organization_id: this.organization?.id,
              subscription_id: subscriptionId,
              limit: 100,
            }),
          )
        }
        // Fetch all purchased products with subscriptions for this user
        const products = await Promise.all(promises).then((results) => results.flat())

        // Filter only subscription products (those with subscription_id)
        this.subscriptionPurchasedProducts = products.filter(
          (product) => product.subscription_id != null,
        )

        return { success: true, data: this.subscriptionPurchasedProducts }
      } catch (error: unknown) {
        console.error('Failed to fetch subscription purchased products:', error)
        const errorMessage =
          (error as { response?: { data?: { message?: string } } }).response?.data?.message ||
          'Failed to fetch subscription purchased products'
        return { success: false, error: errorMessage }
      } finally {
        this.purchasedProductsLoading = false
      }
    },
  },
})
