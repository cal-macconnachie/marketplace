import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useAppStore } from './stores/app'
import { useThemeStore } from './stores/theme'
import './styles/tokens.css'

// Inject environment variable into window for constants package
declare global {
  interface Window {
    __MARKETPLACE_ENV__: string
  }
}
window.__MARKETPLACE_ENV__ = import.meta.env.VITE_ENV_NAME || import.meta.env.VITE_API_ENV || 'dev'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// Initialize stores
const appStore = useAppStore()
const themeStore = useThemeStore()

// Initialize auth and theme
appStore.initializeAuth()
themeStore.initTheme()

app.mount('#app')
