import type { BrowserCart, CheckoutData, MessageData } from '@marketplace/types'
import { minify } from 'terser'

// Global interface extensions for the iframe context
declare global {
  interface Window {
    generateCheckoutUrl?: (
      checkoutDomain: string,
      additionalParams?: Record<string, string>,
    ) => string | null
  }
}

/**
 * The actual onload function with full TypeScript support
 * This function will be converted to a string and minified
 */
function iframeOnloadHandler(this: HTMLIFrameElement): void {
  // eslint-disable-next-line @typescript-eslint/no-this-alias
  const iframe = this
  let lastHeight = 200
  iframe.style.height = '200px'

  // Initialize cart storage with hostname-based key
  const getCartStorageKey = (): string => {
    try {
      // Simple hostname extraction without URL constructor
      const src = iframe.src
      const protocolEnd = src.indexOf('://')
      if (protocolEnd === -1) return 'cart_unknown'

      const afterProtocol = src.substring(protocolEnd + 3)
      const pathStart = afterProtocol.indexOf('/')
      const hostname = pathStart === -1 ? afterProtocol : afterProtocol.substring(0, pathStart)

      return `cart_${hostname}`
    } catch {
      return 'cart_default'
    }
  }
  const cartKey = getCartStorageKey()
  if (!localStorage.getItem(cartKey)) {
    localStorage.setItem(cartKey, JSON.stringify({}))
  }

  const handleCartUpdate = (
    cartData: {
      groupId: string
      productId: string
      organizationId: string
      quantity: number
      action: 'add' | 'remove'
    },
    cart: BrowserCart,
  ): void => {
    const itemKey = `${cartData.groupId}_${cartData.productId}`

    if (cartData.action === 'add') {
      if (cart[itemKey]) {
        cart[itemKey].quantity += cartData.quantity
      } else {
        cart[itemKey] = {
          groupId: cartData.groupId,
          productId: cartData.productId,
          quantity: cartData.quantity,
          organizationId: cartData.organizationId,
        }
      }
    } else if (cartData.action === 'remove') {
      if (cart[itemKey]) {
        cart[itemKey].quantity -= cartData.quantity
        if (cart[itemKey].quantity <= 0) {
          delete cart[itemKey]
        }
      }
    }

    localStorage.setItem(cartKey, JSON.stringify(cart))

    // Dispatch cart update event
    window.dispatchEvent(
      new CustomEvent('cart-updated', {
        detail: { cart },
      }),
    )
  }

  const generateCheckoutUrl = (
    checkoutDomain: string,
    additionalParams?: Record<string, string>,
  ): string | null => {
    try {
      const cart: BrowserCart = JSON.parse(localStorage.getItem(cartKey) || '{}')
      const cartArray = Object.values(cart)
      const cartData: CheckoutData = {
        items: cartArray,
        timestamp: Date.now(),
        domain: window.location.href,
      }

      const serializedCart = btoa(JSON.stringify(cartData))
      const url = new URL(`https://${checkoutDomain}/checkout`)
      url.searchParams.set('cart', serializedCart)
      url.searchParams.set('source', window.location.href)

      if (additionalParams) {
        Object.entries(additionalParams).forEach(([key, value]) => {
          url.searchParams.set(key, value)
        })
      }

      return url.toString()
    } catch (error) {
      console.error('Error generating checkout URL:', error)
      return null
    }
  }

  const parseIframeUrl = (iframeSrc: string) => {
    const protocolEnd = iframeSrc.indexOf('://')
    const protocol = iframeSrc.substring(0, protocolEnd + 1)
    const afterProtocol = iframeSrc.substring(protocolEnd + 3)
    const pathStart = afterProtocol.indexOf('/')
    const host = pathStart === -1 ? afterProtocol : afterProtocol.substring(0, pathStart)
    return { protocol, host }
  }

  const handleCartLinkRequest = (): void => {
    const cart: BrowserCart = JSON.parse(localStorage.getItem(cartKey) || '{}')
    const cartArray = Object.values(cart)

    if (cartArray.length > 0) {
      const { protocol, host } = parseIframeUrl(iframe.src)

      const cartPath = `/cart`
      const cartParams = `?source=${encodeURIComponent(window.location.hostname)}`
      const cartUrl = `${protocol}//${host}${cartPath}${cartParams}`

      iframe.contentWindow?.postMessage(
        {
          type: 'cart-link-response',
          cartLink: cartUrl,
        },
        '*',
      )
    } else {
      const { protocol, host } = parseIframeUrl(iframe.src)
      const basicCartUrl = `${protocol}//${host}/cart`

      iframe.contentWindow?.postMessage(
        {
          type: 'cart-link-response',
          cartLink: basicCartUrl,
        },
        '*',
      )
    }
  }

  // Set up global checkout helper function
  window.generateCheckoutUrl = generateCheckoutUrl

  window.addEventListener('message', (e: MessageEvent<MessageData>) => {
    if (e.data && e.source === iframe.contentWindow) {
      const { type, data: messageData, source: messageSource, height } = e.data

      switch (type) {
        case 'request-initial-cart': {
          const cart: BrowserCart = JSON.parse(localStorage.getItem(cartKey) || '{}')
          iframe.contentWindow?.postMessage(
            {
              type: 'initial-cart-data',
              cart,
            },
            '*',
          )
          break
        }

        case 'resize': {
          const iframeSource = iframe.src
          if (messageSource && iframeSource && messageSource === iframeSource && height) {
            const newHeight = parseInt(height)
            if (newHeight > 0 && Math.abs(newHeight - lastHeight) > 2) {
              lastHeight = newHeight
              iframe.style.height = `${newHeight}px`
              iframe.style.minHeight = `${newHeight}px`
            }
          }
          break
        }

        case 'cart-updated': {
          if (messageData) {
            const cart: BrowserCart = JSON.parse(localStorage.getItem(cartKey) || '{}')
            handleCartUpdate(
              messageData as {
                groupId: string
                productId: string
                organizationId: string
                quantity: number
                action: 'add' | 'remove'
              },
              cart,
            )
          }
          break
        }

        case 'request-cart-link': {
          handleCartLinkRequest()
          break
        }
      }
    }
  })
}

/**
 * Converts a TypeScript function to a string representation
 */
function functionToString(fn: (this: HTMLIFrameElement) => void): string {
  return fn.toString()
}

/**
 * Minifies JavaScript code using Terser
 */
async function minifyJavaScript(code: string): Promise<string> {
  try {
    const result = await minify(code, {
      compress: {
        dead_code: true,
        drop_console: false, // Keep console for debugging
        sequences: true,
        join_vars: true,
        conditionals: true,
        comparisons: true,
        evaluate: true,
        booleans: true,
        loops: true,
        unused: true,
        hoist_funs: true,
        keep_fargs: false,
        hoist_vars: false,
        if_return: true,
        collapse_vars: true,
        reduce_vars: true,
      },
      mangle: {
        toplevel: false, // Don't mangle top-level names to avoid issues
      },
      format: {
        comments: false,
        beautify: false,
        ascii_only: true, // Ensure compatibility
      },
    })

    return result.code || code
  } catch (error) {
    console.error('Error during minification:', error)
    return code // Return original code if minification fails
  }
}

/**
 * Generates a complete embed code with minified onload script
 */
export async function generateEmbedCode(shareUrl: string): Promise<string> {
  // Convert the TypeScript function to a string
  const functionString = functionToString(iframeOnloadHandler)

  // Extract just the function body (remove function declaration wrapper)
  const functionBody = functionString.slice(
    functionString.indexOf('{') + 1,
    functionString.lastIndexOf('}'),
  )

  // Minify the function body
  const minifiedOnloadScript = await minifyJavaScript(functionBody)

  // Escape the script for HTML attribute use
  const escapedScript = minifiedOnloadScript
    .replace(/\\/g, '\\\\') // Escape backslashes
    .replace(/"/g, '&quot;') // Escape double quotes
    .replace(/'/g, '&#39;') // Escape single quotes
    .replace(/\n/g, ' ') // Replace newlines with spaces
    .replace(/\r/g, '') // Remove carriage returns

  return `<iframe 
  src="${shareUrl}" 
  width="100%" 
  height="100%"
  style="border: none; border-radius: 8px; min-height: 200px; overflow: hidden; display: block;" 
  scrolling="no"
  frameborder="0"
  onload="${escapedScript}"
></iframe>`
}
