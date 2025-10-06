import type { CartItem, BrowserCart, SerializedCartData } from '@marketplace/types'

export class CartService {
  constructor() {
    // Single window only - no cross-tab syncing needed
  }

  private getCartKey(): string {
    return 'cart'
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
  serializeCart(): string {
    const cart = this.getCart()
    const cartArray = Object.values(cart)

    // Convert to base64 encoded JSON for URL safety
    const cartData: SerializedCartData = {
      items: cartArray,
      timestamp: Date.now(),
      domain: window.location.href,
    }

    return btoa(JSON.stringify(cartData))
  }

  deserializeCart(encodedCart: string): CartItem[] {
    try {
      const decoded = atob(encodedCart)
      const cartData = JSON.parse(decoded)

      // Validate data structure
      if (!cartData.items || !Array.isArray(cartData.items)) {
        throw new Error('Invalid cart data structure')
      }

      // Check if cart is not too old (24 hours)
      const maxAge = 24 * 60 * 60 * 1000 // 24 hours in ms
      if (Date.now() - cartData.timestamp > maxAge) {
        console.warn('BrowserCart data is older than 24 hours, may be stale')
      }

      return cartData.items
    } catch (error) {
      console.error('Error deserializing cart:', error)
      return []
    }
  }

  importCartFromSerialized(encodedCart: string): void {
    const cartItems = this.deserializeCart(encodedCart)
    const cart = this.getCart()

    // Merge imported items with existing cart
    cartItems.forEach((item) => {
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
}

export const cartService = new CartService()
