import type { Product } from '@marketplace/types'

/**
 * Calculates the maximum quantity that can be purchased for a product
 * based on its quantity_limit and current quantity in stock.
 *
 * @param product - The product to calculate max quantity for
 * @param defaultMax - Default maximum if no limits are set (default: 99)
 * @returns The maximum quantity that can be purchased
 *
 * @example
 * ```typescript
 * // Product with quantity_limit of 5 and quantity of 3
 * getMaxPurchaseQuantity(product) // returns 3
 *
 * // Product with quantity_limit of 5 and quantity of 10
 * getMaxPurchaseQuantity(product) // returns 5
 *
 * // Product with no limits
 * getMaxPurchaseQuantity(product) // returns 99
 * ```
 */
export function getMaxPurchaseQuantity(product: Product, defaultMax = 99): number {
  const limits: number[] = [defaultMax]

  // Add quantity_limit if it exists
  if (product.quantity_limit !== undefined && product.quantity_limit > 0) {
    limits.push(product.quantity_limit)
  }

  // Add current quantity if it exists
  if (product.quantity !== undefined && product.quantity >= 0) {
    limits.push(product.quantity)
  }

  // Return the minimum of all applicable limits
  const result = Math.min(...limits)

  // Debug logging
  console.log('[getMaxPurchaseQuantity]', {
    productName: product.name,
    quantity_limit: product.quantity_limit,
    quantity: product.quantity,
    limits,
    result
  })

  return result
}

/**
 * Checks if a product is sold out (has zero quantity available)
 *
 * @param product - The product to check
 * @returns true if the product is sold out, false otherwise
 *
 * @example
 * ```typescript
 * isProductSoldOut({ quantity: 0 }) // returns true
 * isProductSoldOut({ quantity: 5 }) // returns false
 * isProductSoldOut({ quantity: undefined }) // returns false
 * ```
 */
export function isProductSoldOut(product: Product): boolean {
  return product.quantity !== undefined && product.quantity === 0
}
