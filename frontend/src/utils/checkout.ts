import type { CartItem } from '@marketplace/types'
import { cartService } from './cart'

export class CheckoutService {
  /**
   * Initialize checkout page by checking for cart data in URL params
   */
  initializeFromUrl(): CartItem[] {
    const urlParams = new URLSearchParams(window.location.search)
    const encodedCart = urlParams.get('cart')
    if (encodedCart) {
      try {
        const cartData = cartService.deserializeCart(encodedCart)

        if (!cartData || !Array.isArray(cartData.items)) {
          return []
        }

        // Import the cart data into local storage
        cartService.importCartFromSerialized(encodedCart)

        // Clean up URL to remove cart data
        this.cleanUpUrl()

        return cartData.items
      } catch (error) {
        console.error('Failed to import cart from URL:', error)
        return []
      }
    }

    return []
  }

  /**
   * Clean up URL parameters after importing cart
   */
  private cleanUpUrl(): void {
    const url = new URL(window.location.href)
    url.searchParams.delete('cart')
    url.searchParams.delete('source')

    // Update URL without reloading page
    window.history.replaceState({}, document.title, url.toString())
  }

  /**
   * Get cart items that were imported from another domain
   */
  getImportedCart(): CartItem[] {
    return cartService.getAllItems()
  }

  /**
   * Generate a cart summary for checkout display
   */
  getCartSummary(): {
    items: CartItem[]
    totalItems: number
    totalValue?: number
  } {
    const items = cartService.getAllItems()
    const totalItems = cartService.getTotalItems()

    return {
      items,
      totalItems,
    }
  }
}

export const checkoutService = new CheckoutService()

// Auto-initialize if we're on a page with cart parameters
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.has('cart')) {
      checkoutService.initializeFromUrl()
    }
  })
}
