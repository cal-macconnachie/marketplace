import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { Theme } from '@marketplace/types'

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<Theme>('system')
  const isDark = ref(false)

  // Check system preference
  const getSystemTheme = (): 'light' | 'dark' => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return 'light'
  }

  // Initialize theme from localStorage or system preference
  const initTheme = () => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme') as Theme
      if (stored && ['light', 'dark', 'system'].includes(stored)) {
        theme.value = stored
      }
      updateTheme()
    }
  }

  // Update the actual theme applied to the document
  const updateTheme = () => {
    if (typeof window === 'undefined') return

    let resolvedTheme: 'light' | 'dark'
    
    if (theme.value === 'system') {
      resolvedTheme = getSystemTheme()
    } else {
      resolvedTheme = theme.value
    }

    isDark.value = resolvedTheme === 'dark'
    
    // Update document data attribute
    document.documentElement.setAttribute('data-theme', resolvedTheme)
    
    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]')
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', resolvedTheme === 'dark' ? '#0f172a' : '#ffffff')
    }
  }

  // Set theme and persist to localStorage
  const setTheme = (newTheme: Theme) => {
    theme.value = newTheme
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', newTheme)
    }
    updateTheme()
  }

  // Toggle between light and dark (bypass system)
  const toggleTheme = () => {
    if (theme.value === 'system') {
      // If currently system, switch to opposite of current resolved theme
      setTheme(isDark.value ? 'light' : 'dark')
    } else {
      // If explicit theme, toggle between light and dark
      setTheme(theme.value === 'light' ? 'dark' : 'light')
    }
  }

  // Watch for system theme changes
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', () => {
      if (theme.value === 'system') {
        updateTheme()
      }
    })
  }

  // Watch theme changes
  watch(theme, updateTheme)

  return {
    theme,
    isDark,
    initTheme,
    setTheme,
    toggleTheme,
  }
})