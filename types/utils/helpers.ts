/**
 * Generic utility types for the Marketplace application
 */

/**
 * UpdateRequest<T> - Makes all fields of type T optional and allows them to be either
 * their original type or an empty string for deletion in DynamoDB updates.
 *
 * Empty strings are used to signal field removal in DynamoDB update operations.
 *
 * @example
 * ```typescript
 * const updateData: UpdateRequest<Product> = {
 *   name: "New Product Name",
 *   quantity: '',  // Remove quantity field from DB
 *   price: 99.99
 * }
 * ```
 */
export type UpdateRequest<T> = {
  [K in keyof T]?: T[K] | ''
}
