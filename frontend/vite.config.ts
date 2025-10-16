import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@marketplace/constants': fileURLToPath(new URL('../constants/src/index.ts', import.meta.url))
    },
  },
  define: {
    // Inject VITE_API_ENV as a global constant for @marketplace/constants
    'VITE_API_ENV': JSON.stringify(process.env.VITE_API_ENV || 'dev'),
  },
})
