import type { Organization } from '../../entities/organization'
import type { User } from '../../entities/user'
import type { PurchasedProduct } from '../../entities/product'

/**
 * Response from getting an organization
 */
export interface GetOrganizationResponse extends Organization {}

/**
 * Response from updating an organization
 */
export interface UpdateOrganizationResponse extends Organization {}

/**
 * Response from getting users
 */
export type GetUsersResponse = User[]

/**
 * Response from updating a user
 */
export interface UpdateUserResponse extends User {}

/**
 * Response from getting purchased products for an organization
 */
export type GetPurchasedProductsResponse = PurchasedProduct[]
