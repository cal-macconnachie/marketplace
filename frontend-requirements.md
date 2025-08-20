# Frontend Requirements: Vue 3 Authentication Integration

## Overview
This guide explains how to integrate a Vue 3 frontend with the AWS Cognito + Lambda authentication system that supports both email/password and social sign-in (Google, Apple). We provide two approaches: **Amplify-based** and **Custom Implementation**.

## Authentication Flow Summary

### Email/Password Flow
1. **Register**: `POST /register` → Creates user in Cognito + DynamoDB
2. **Login**: `POST /login` → Returns JWT tokens + user data
3. **Refresh**: `POST /refresh` → Refreshes access token
4. **Logout**: `POST /logout` → Invalidates tokens

### Social Sign-In Flow
1. **Social Login**: User authenticates with Google/Apple via Cognito Hosted UI or Custom OAuth
2. **Post-Auth Trigger**: Automatically creates DynamoDB record
3. **Frontend Receives**: Authorization code/tokens from Cognito
4. **Login**: `POST /login` with `accessToken` → Returns unified response

---

## Required Dependencies
```json
{
  "dependencies": {
    "vue": "^3.3.0",
    "vue-router": "^4.0.0",
    "pinia": "^2.1.0",
    "axios": "^1.6.0"
  }
}
```

## Configuration

```typescript
// src/config/auth-config.ts
export const authConfig = {
  cognitoRegion: 'us-east-1',
  userPoolId: 'us-east-1_XXXXXXXXX',
  clientId: 'XXXXXXXXXXXXXXXXXXXXXXXXXX',
  cognitoDomain: 'your-app.auth.us-east-1.amazoncognito.com',
  apiBaseUrl: 'https://your-api-gateway.execute-api.us-east-1.amazonaws.com/prod',
  social: {
    google: {
      clientId: 'your-google-client-id.googleusercontent.com'
    },
    apple: {
      clientId: 'com.yourapp.signin',
      redirectUri: 'https://your-app.com/callback'
    }
  }
}
```

## Custom Auth Store (Pinia)

```typescript
// src/stores/auth.ts
import { defineStore } from 'pinia'
import axios from 'axios'
import { authConfig } from '@/config/auth-config'

interface User {
  email: string
  cognito_id: string
  phone_number?: string
  social_provider?: string
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  idToken: string | null
  isAuthenticated: boolean
  loading: boolean
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    accessToken: null,
    refreshToken: null,
    idToken: null,
    isAuthenticated: false,
    loading: false
  }),

  actions: {
    async register(email: string, password: string, phone_number?: string) {
      this.loading = true
      try {
        const response = await axios.post(`${authConfig.apiBaseUrl}/register`, {
          email,
          password,
          phone_number
        })
        return response.data
      } catch (error) {
        throw error
      } finally {
        this.loading = false
      }
    },

    async login(username: string, password: string) {
      this.loading = true
      try {
        const response = await axios.post(`${authConfig.apiBaseUrl}/login`, {
          username,
          password
        })
        
        this.setAuthData(response.data)
        return response.data
      } catch (error) {
        throw error
      } finally {
        this.loading = false
      }
    },

    async socialLogin(accessToken: string) {
      this.loading = true
      try {
        const response = await axios.post(`${authConfig.apiBaseUrl}/login`, {
          accessToken
        })
        
        this.setAuthData(response.data)
        return response.data
      } catch (error) {
        throw error
      } finally {
        this.loading = false
      }
    },

    async refreshToken() {
      if (!this.refreshToken) throw new Error('No refresh token')
      
      try {
        const response = await axios.post(`${authConfig.apiBaseUrl}/refresh`, {
          refreshToken: this.refreshToken
        })
        
        this.accessToken = response.data.accessToken
        this.idToken = response.data.idToken
        if (response.data.refreshToken) {
          this.refreshToken = response.data.refreshToken
        }
        
        this.saveToStorage()
        return response.data
      } catch (error) {
        this.logout()
        throw error
      }
    },

    async logout() {
      if (this.accessToken) {
        try {
          await axios.post(`${authConfig.apiBaseUrl}/logout`, {
            accessToken: this.accessToken
          })
        } catch (error) {
          console.error('Logout error:', error)
        }
      }
      
      this.clearAuthData()
    },

    setAuthData(data: any) {
      this.accessToken = data.accessToken
      this.refreshToken = data.refreshToken
      this.idToken = data.idToken
      this.user = data.user
      this.isAuthenticated = true
      this.saveToStorage()
    },

    clearAuthData() {
      this.user = null
      this.accessToken = null
      this.refreshToken = null
      this.idToken = null
      this.isAuthenticated = false
      this.clearStorage()
    },

    saveToStorage() {
      if (this.accessToken) localStorage.setItem('accessToken', this.accessToken)
      if (this.refreshToken) localStorage.setItem('refreshToken', this.refreshToken)
      if (this.idToken) localStorage.setItem('idToken', this.idToken)
      if (this.user) localStorage.setItem('user', JSON.stringify(this.user))
    },

    clearStorage() {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('idToken')
      localStorage.removeItem('user')
    },

    initializeAuth() {
      const accessToken = localStorage.getItem('accessToken')
      const refreshToken = localStorage.getItem('refreshToken')
      const idToken = localStorage.getItem('idToken')
      const user = localStorage.getItem('user')
      
      if (accessToken && refreshToken) {
        this.accessToken = accessToken
        this.refreshToken = refreshToken
        this.idToken = idToken
        this.user = user ? JSON.parse(user) : null
        this.isAuthenticated = true
      }
    }
  }
})
```

## Custom Social Login Components

### Google Sign-In Component
```vue
<!-- src/components/GoogleSignIn.vue -->
<template>
  <button 
    @click="signInWithGoogle" 
    :disabled="loading"
    class="google-signin-btn"
  >
    <svg width="18" height="18" viewBox="0 0 18 18" class="google-icon">
      <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
      <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.04a4.8 4.8 0 0 1-7.18-2.53H1.83v2.07A8 8 0 0 0 8.98 17z"/>
      <path fill="#FBBC05" d="M4.5 10.49a4.8 4.8 0 0 1 0-3.07V5.35H1.83a8 8 0 0 0 0 7.28l2.67-2.14z"/>
      <path fill="#EA4335" d="M8.98 4.72c1.16 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.35L4.5 7.42a4.77 4.77 0 0 1 4.48-2.7z"/>
    </svg>
    {{ loading ? 'Signing in...' : 'Continue with Google' }}
  </button>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { authConfig } from '@/config/auth-config'

const authStore = useAuthStore()
const loading = ref(false)

let googleAuth: any = null

onMounted(async () => {
  // Load Google Identity Services
  await loadGoogleScript()
  initializeGoogle()
})

const loadGoogleScript = () => {
  return new Promise((resolve) => {
    if (document.getElementById('google-signin-script')) {
      resolve(true)
      return
    }

    const script = document.createElement('script')
    script.id = 'google-signin-script'
    script.src = 'https://accounts.google.com/gsi/client'
    script.onload = resolve
    document.head.appendChild(script)
  })
}

const initializeGoogle = () => {
  if (typeof window.google !== 'undefined') {
    window.google.accounts.id.initialize({
      client_id: authConfig.social.google.clientId,
      callback: handleGoogleResponse,
      auto_select: false,
      cancel_on_tap_outside: false
    })
  }
}

const signInWithGoogle = () => {
  loading.value = true
  
  // Generate OAuth URL for Cognito
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: authConfig.clientId,
    redirect_uri: `${window.location.origin}/callback`,
    identity_provider: 'Google',
    scope: 'email openid profile'
  })
  
  const cognitoUrl = `https://${authConfig.cognitoDomain}/oauth2/authorize?${params}`
  window.location.href = cognitoUrl
}

const handleGoogleResponse = async (response: any) => {
  try {
    // This would be used if implementing direct Google OAuth
    // For Cognito, we redirect to Cognito's hosted UI
    console.log('Google response:', response)
  } catch (error) {
    console.error('Google sign-in error:', error)
    loading.value = false
  }
}
</script>

<style scoped>
.google-signin-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px 24px;
  background: white;
  border: 1px solid #dadce0;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #3c4043;
  cursor: pointer;
  transition: background-color 0.2s;
  width: 100%;
}

.google-signin-btn:hover {
  background-color: #f8f9fa;
}

.google-signin-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.google-icon {
  flex-shrink: 0;
}
</style>
```

### Apple Sign-In Component
```vue
<!-- src/components/AppleSignIn.vue -->
<template>
  <button 
    @click="signInWithApple" 
    :disabled="loading"
    class="apple-signin-btn"
  >
    <svg width="18" height="18" viewBox="0 0 18 18" class="apple-icon">
      <path fill="currentColor" d="M15.769 10.16c-.041 4.289 3.491 5.693 3.491 5.693-.041.125-0.549 1.851-1.809 3.66-1.096 1.571-2.234 3.14-4.021 3.165-1.745.025-2.307-.998-4.3-.998s-2.597.973-4.238 1.022c-1.704.05-3.008-1.676-4.129-3.236C-1.506 16.44-0.32 10.632 1.899 7.647c1.095-1.477 3.053-2.415 5.179-2.44 1.621-.026 3.148 1.056 4.137 1.056.99 0 2.844-1.306 4.791-.1"/>
      <path fill="currentColor" d="M12.165 5.938c.746-.872 1.245-2.077 1.108-3.281-1.07.043-2.366.693-3.137 1.565-.692.783-1.296 2.036-1.133 3.24 1.197.093 2.42-.59 3.162-1.524"/>
    </svg>
    {{ loading ? 'Signing in...' : 'Continue with Apple' }}
  </button>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { authConfig } from '@/config/auth-config'

const loading = ref(false)

const signInWithApple = () => {
  loading.value = true
  
  // Generate OAuth URL for Cognito with Apple
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: authConfig.clientId,
    redirect_uri: `${window.location.origin}/callback`,
    identity_provider: 'SignInWithApple',
    scope: 'email openid profile'
  })
  
  const cognitoUrl = `https://${authConfig.cognitoDomain}/oauth2/authorize?${params}`
  window.location.href = cognitoUrl
}
</script>

<style scoped>
.apple-signin-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px 24px;
  background: black;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: white;
  cursor: pointer;
  transition: background-color 0.2s;
  width: 100%;
}

.apple-signin-btn:hover {
  background-color: #333;
}

.apple-signin-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.apple-icon {
  flex-shrink: 0;
}
</style>
```

### Custom Login Form
```vue
<!-- src/components/CustomLoginForm.vue -->
<template>
  <div class="login-container">
    <form @submit.prevent="handleEmailLogin" class="login-form">
      <h2>Sign In</h2>
      
      <div class="form-group">
        <label for="email">Email</label>
        <input 
          id="email"
          v-model="email" 
          type="email" 
          placeholder="Enter your email" 
          required 
          class="form-input"
        />
      </div>
      
      <div class="form-group">
        <label for="password">Password</label>
        <input 
          id="password"
          v-model="password" 
          type="password" 
          placeholder="Enter your password" 
          required 
          class="form-input"
        />
      </div>
      
      <button type="submit" :disabled="loading" class="submit-btn">
        {{ loading ? 'Signing in...' : 'Sign In' }}
      </button>
      
      <div v-if="error" class="error-message">
        {{ error }}
      </div>
    </form>

    <div class="divider">
      <span>or</span>
    </div>

    <div class="social-login">
      <GoogleSignIn />
      <AppleSignIn />
    </div>

    <div class="signup-link">
      <p>Don't have an account? <router-link to="/register">Sign up</router-link></p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import GoogleSignIn from './GoogleSignIn.vue'
import AppleSignIn from './AppleSignIn.vue'

const authStore = useAuthStore()
const router = useRouter()

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

const handleEmailLogin = async () => {
  loading.value = true
  error.value = ''
  
  try {
    await authStore.login(email.value, password.value)
    router.push('/dashboard')
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Login failed'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  max-width: 400px;
  margin: 0 auto;
  padding: 2rem;
}

.login-form {
  margin-bottom: 2rem;
}

.login-form h2 {
  text-align: center;
  margin-bottom: 2rem;
  color: #333;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #333;
}

.form-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #007bff;
}

.submit-btn {
  width: 100%;
  padding: 12px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.submit-btn:hover:not(:disabled) {
  background: #0056b3;
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  margin-top: 1rem;
  padding: 12px;
  background: #fee;
  color: #c33;
  border: 1px solid #fcc;
  border-radius: 8px;
  font-size: 14px;
}

.divider {
  text-align: center;
  margin: 2rem 0;
  position: relative;
}

.divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: #ddd;
}

.divider span {
  background: white;
  padding: 0 1rem;
  color: #666;
  font-size: 14px;
}

.social-login {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;
}

.signup-link {
  text-align: center;
}

.signup-link a {
  color: #007bff;
  text-decoration: none;
}

.signup-link a:hover {
  text-decoration: underline;
}
</style>
```

### OAuth Callback Handler
```vue
<!-- src/views/CallbackView.vue -->
<template>
  <div class="callback-container">
    <div class="callback-content">
      <div v-if="loading" class="loading">
        <div class="spinner"></div>
        <p>Processing authentication...</p>
      </div>
      <div v-else-if="error" class="error">
        <h3>Authentication Failed</h3>
        <p>{{ error }}</p>
        <button @click="redirectToLogin" class="retry-btn">
          Try Again
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { authConfig } from '@/config/auth-config'
import axios from 'axios'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    const authCode = route.query.code as string
    const state = route.query.state as string
    
    if (!authCode) {
      throw new Error('No authorization code received')
    }

    // Exchange authorization code for tokens
    const tokenResponse = await axios.post(`https://${authConfig.cognitoDomain}/oauth2/token`, 
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: authConfig.clientId,
        code: authCode,
        redirect_uri: `${window.location.origin}/callback`
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    )

    const { access_token, id_token, refresh_token } = tokenResponse.data

    // Send access token to your backend for unified login
    await authStore.socialLogin(access_token)
    
    router.push('/dashboard')
  } catch (err: any) {
    console.error('Callback error:', err)
    error.value = err.response?.data?.error || err.message || 'Authentication failed'
  } finally {
    loading.value = false
  }
})

const redirectToLogin = () => {
  router.push('/login')
}
</script>

<style scoped>
.callback-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 2rem;
}

.callback-content {
  text-align: center;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error {
  color: #c33;
}

.retry-btn {
  margin-top: 1rem;
  padding: 10px 20px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

.retry-btn:hover {
  background: #0056b3;
}
</style>
```

## Custom Implementation Key Features

- ✅ **No External Dependencies**: Pure Vue 3 + Axios implementation
- ✅ **Custom UI Components**: Full control over design and UX
- ✅ **Direct OAuth Integration**: Handle Google/Apple OAuth flows manually
- ✅ **Flexible Configuration**: Easy to customize and extend
- ✅ **Lightweight**: Minimal bundle size
- ✅ **Custom Token Management**: Full control over token handling

## Testing Both Approaches

1. **Email Registration**: Test `/register` endpoint
2. **Email Login**: Test `/login` with username/password
3. **Social Login**: Test Google/Apple OAuth flow
4. **Token Refresh**: Test automatic token renewal
5. **Protected Routes**: Verify auth guards work
6. **Logout**: Test complete session cleanup