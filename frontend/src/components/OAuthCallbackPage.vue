<template>
  <div class="oauth-callback-page">
    <BaseCard class="callback-card" padding="lg">
      <div class="callback-content">
        <template v-if="status === 'loading'">
          <LoadingSpinner :size="48" />
          <h2>Completing sign in...</h2>
        </template>

        <template v-else-if="status === 'error'">
          <div class="error-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="icon icon-tabler icon-tabler-alert-circle"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="9" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="8" />
            </svg>
          </div>
          <h2>Authentication Failed</h2>
          <p class="error-message">{{ errorMessage }}</p>
          <BaseButton @click="redirectToSignIn" full-width size="lg">
            Return to Sign In
          </BaseButton>
        </template>
      </div>
    </BaseCard>
  </div>
</template>

<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import { authAPI } from '@/services/api'
import { useAppStore } from '@/stores/app'
import { exchangeCodeForTokens, validateState } from '@/utils/oauth'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const app = useAppStore()

const status = ref<'loading' | 'error'>('loading')
const errorMessage = ref('')

async function handleOAuthCallback() {
  try {
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    const state = urlParams.get('state')
    const error = urlParams.get('error')
    const errorDescription = urlParams.get('error_description')

    // Check for OAuth errors
    if (error) {
      throw new Error(errorDescription || `OAuth error: ${error}`)
    }

    // Validate required parameters
    if (!code || !state) {
      throw new Error('Missing authorization code or state parameter')
    }

    // Validate state to prevent CSRF attacks
    if (!validateState(state)) {
      throw new Error('Invalid state parameter. Please try signing in again.')
    }

    // Exchange authorization code for tokens from Cognito
    const tokens = await exchangeCodeForTokens(code)

    // Call backend login endpoint with all Cognito tokens
    const response = await authAPI.oauthLogin({
      accessToken: tokens.access_token,
      idToken: tokens.id_token,
      refreshToken: tokens.refresh_token,
    })

    // Set authentication in the store (same as regular login flow)
    app.setAuth(response)

    // Fetch user data if not provided in auth response
    if (!response.user) {
      await app.fetchCurrentUser()
    }

    // Fetch organization data
    await app.fetchOrganization()

    // Check if there's a stored page to return to
    const lastViewedPage = localStorage.getItem('last_viewed_page')

    if (lastViewedPage) {
      // Clean up the stored value
      localStorage.removeItem('last_viewed_page')
      // Redirect back to the stored page
      await router.push(lastViewedPage)
    } else {
      // Default: redirect to dashboard
      await router.push('/dashboard')
    }
  } catch (err: unknown) {
    console.error('OAuth callback error:', err)
    status.value = 'error'
    errorMessage.value =
      (err as { message?: string }).message || 'An unexpected error occurred during authentication'
  }
}

function redirectToSignIn() {
  router.push('/auth')
}

onMounted(() => {
  handleOAuthCallback()
})
</script>

<style scoped>
.oauth-callback-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}

.callback-card {
  width: 100%;
  max-width: var(--size-md);
  animation: slideUp 0.3s ease-out;
}

.callback-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-4);
  padding: var(--space-6);
}

h2 {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

p {
  margin: 0;
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
}

.error-message {
  color: var(--color-danger);
}

.error-icon {
  font-size: 48px;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 640px) {
  .oauth-callback-page {
    padding: var(--space-2);
  }

  .callback-content {
    padding: var(--space-4);
  }
}
</style>
