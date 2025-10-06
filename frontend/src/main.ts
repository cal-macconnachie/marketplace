import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useAppStore } from './stores/app'
import { useThemeStore } from './stores/theme'
import './styles/tokens.css'

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
