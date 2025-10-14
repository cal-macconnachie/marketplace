import type { CartItem, BrowserCart, SerializedCartData } from '@marketplace/types'

export class CartService {
  constructor() {
    // Single window only - no cross-tab syncing needed
  }

  private getCartKey(): string {
    return `cart_${window.location.hostname}`
  }

  getCart(): BrowserCart {
    const cartKey = this.getCartKey()
    const cartData = localStorage.getItem(cartKey)
    if (!cartData) throw new Error('BrowserCart is empty')
    return JSON.parse(cartData)
  }

  private saveCart(cart: BrowserCart): void {
    const cartKey = this.getCartKey()
    localStorage.setItem(cartKey, JSON.stringify(cart))
  }

  private calculateTotalItems(cart: BrowserCart): number {
    return Object.values(cart).reduce((total, item) => total + item.quantity, 0)
  }

  addItem(groupId: string, productId: string, quantity: number): void {
    const cart = this.getCart()
    const itemKey = `${groupId}_${productId}`

    if (cart[itemKey]) {
      cart[itemKey].quantity += quantity
    } else {
      cart[itemKey] = {
        groupId,
        productId,
        quantity,
        organizationId: '', // To be filled in at checkout
      }
    }

    this.saveCart(cart)
  }

  removeItem(groupId: string, productId: string, quantity: number): void {
    const cart = this.getCart()
    const itemKey = `${groupId}_${productId}`

    if (cart[itemKey]) {
      cart[itemKey].quantity -= quantity
      if (cart[itemKey].quantity <= 0) {
        delete cart[itemKey]
      }
      this.saveCart(cart)
    }
  }

  updateQuantity(groupId: string, productId: string, quantity: number): void {
    const cart = this.getCart()
    const itemKey = `${groupId}_${productId}`

    if (cart[itemKey]) {
      if (quantity <= 0) {
        delete cart[itemKey]
      } else {
        cart[itemKey].quantity = quantity
      }
      this.saveCart(cart)
    }
  }

  getItem(groupId: string, productId: string): CartItem | null {
    const cart = this.getCart()
    const itemKey = `${groupId}_${productId}`
    return cart[itemKey] || null
  }

  getAllItems(): CartItem[] {
    const cart = this.getCart()
    return Object.values(cart)
  }

  getTotalItems(): number {
    const cart = this.getCart()
    return Object.values(cart).reduce((total, item) => total + item.quantity, 0)
  }

  clearCart(): void {
    const cartKey = this.getCartKey()
    localStorage.removeItem(cartKey)
  }

  // Cross-domain cart sharing methods
  serializeCart(source?: string): string {
    const cart = this.getCart()
    const cartArray = Object.values(cart)

    // Convert to base64 encoded JSON for URL safety
    const cartData: SerializedCartData = {
      items: cartArray,
      timestamp: Date.now(),
      domain: window.location.href,
      ...(source && { source }),
    }

    return btoa(JSON.stringify(cartData))
  }

  deserializeCart(encodedCart: string): SerializedCartData | null {
    try {
      const decoded = atob(encodedCart)
      const cartData = JSON.parse(decoded)

      // Validate data structure
      if (!cartData.items || !Array.isArray(cartData.items)) {
        throw new Error('Invalid cart data structure')
      }

      if (typeof cartData.timestamp !== 'number') {
        throw new Error('Invalid cart format: missing or invalid timestamp')
      }

      if (typeof cartData.domain !== 'string') {
        throw new Error('Invalid cart format: missing or invalid domain')
      }

      // Validate each cart item
      cartData.items.forEach((item: unknown, index: number) => {
        const cartItem = item as Record<string, unknown>
        if (!cartItem.groupId || !cartItem.productId || !cartItem.organizationId) {
          throw new Error(`Invalid cart item at index ${index}: missing required fields`)
        }
        if (typeof cartItem.quantity !== 'number' || cartItem.quantity <= 0) {
          throw new Error(`Invalid cart item at index ${index}: invalid quantity`)
        }
      })

      // Check if cart is not too old (24 hours)
      const maxAge = 24 * 60 * 60 * 1000 // 24 hours in ms
      if (Date.now() - cartData.timestamp > maxAge) {
        console.warn('BrowserCart data is older than 24 hours, may be stale')
      }

      return cartData as SerializedCartData
    } catch (error) {
      console.error('Error deserializing cart:', error)
      return null
    }
  }

  importCartFromSerialized(encodedCart: string): void {
    const cartData = this.deserializeCart(encodedCart)
    if (!cartData || !cartData.items) {
      console.warn('Unable to import cart: invalid cart data')
      return
    }

    const cart = this.getCart()

    // Merge imported items with existing cart
    cartData.items.forEach((item) => {
      const itemKey = `${item.groupId}_${item.productId}`
      if (cart[itemKey]) {
        // Add quantities if item already exists
        cart[itemKey].quantity += item.quantity
      } else {
        // Add new item
        cart[itemKey] = { ...item }
      }
    })

    this.saveCart(cart)
  }

  generateCheckoutUrl(checkoutDomain: string, additionalParams?: Record<string, string>): string {
    const serializedCart = this.serializeCart()
    const url = new URL(`https://${checkoutDomain}/checkout`)

    url.searchParams.set('cart', serializedCart)
    url.searchParams.set('source', window.location.href)

    // Add any additional parameters
    if (additionalParams) {
      Object.entries(additionalParams).forEach(([key, value]) => {
        url.searchParams.set(key, value)
      })
    }

    return url.toString()
  }

  /**
   * Updates the current URL with the encoded cart data
   * Removes the cart parameter if the cart is empty
   */
  updateCartInURL(source?: string): void {
    try {
      const cart = this.getCart()
      const cartItems = Object.values(cart)

      if (cartItems.length === 0) {
        // Remove cart parameter if empty
        const url = new URL(window.location.href)
        url.searchParams.delete('cart')
        window.history.replaceState({}, '', url.toString())
        return
      }

      const encodedCart = this.serializeCart(source)
      const url = new URL(window.location.href)
      url.searchParams.set('cart', encodedCart)
      window.history.replaceState({}, '', url.toString())
    } catch (error) {
      // Cart is empty or error occurred - remove cart parameter
      if (error instanceof Error && error.message === 'BrowserCart is empty') {
        const url = new URL(window.location.href)
        url.searchParams.delete('cart')
        window.history.replaceState({}, '', url.toString())
      } else {
        console.error('Error updating cart in URL:', error)
      }
    }
  }

  /**
   * Loads cart from URL query parameter or falls back to localStorage
   * Returns the cart items and the source URL if available
   */
  loadCartFromURLOrStorage(urlCartParam?: string | null): {
    items: CartItem[],
    source?: string
  } {
    // Try URL first
    if (urlCartParam) {
      const cartData = this.deserializeCart(urlCartParam)
      if (cartData && cartData.items && cartData.items.length > 0) {
        // Save to localStorage as backup
        const cart: BrowserCart = {}
        cartData.items.forEach((item) => {
          const itemKey = `${item.groupId}_${item.productId}`
          cart[itemKey] = item
        })
        this.saveCart(cart)

        return {
          items: cartData.items,
          source: cartData.source,
        }
      }
    }

    // Fallback to localStorage
    try {
      const cart = this.getCart()
      const items = Object.values(cart)
      return { items }
    } catch (error) {
      // If localStorage is empty, return empty cart
      return { items: [] }
    }
  }
}

export const cartService = new CartService()
