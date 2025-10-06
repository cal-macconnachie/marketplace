/// <reference types="vite/client" />
/// <reference types="google.maps" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_PLACES_API_KEY: string
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string
  readonly VITE_COGNITO_REGION: string
  readonly VITE_COGNITO_USER_POOL_ID: string
  readonly VITE_COGNITO_CLIENT_ID: string
  readonly VITE_API_ENV: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
