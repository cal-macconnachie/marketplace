/**
 * Theme and UI configuration types
 * Used by frontend for theme management
 */

export type Theme = 'light' | 'dark' | 'system'

export interface ThemeState {
  theme: Theme
  isDark: boolean
}
