import type { Product } from '../../entities/product'

/**
 * Request to create a new product
 */
export interface CreateProductRequest {
  body: Product
}

/**
 * Request to update an existing product
 */
export interface UpdateProductRequest {
  body: Product
  pathParameters: {
    group_id: string
    id: string
  }
}

/**
 * Request to delete a product
 */
export interface DeleteProductRequest {
  pathParameters: {
    group_id: string
    id: string
  }
}

/**
 * Request to get a specific product
 */
export interface GetProductRequest {
  pathParameters: {
    group_id: string
    id: string
  }
}

/**
 * Request to list products
 */
export interface ListProductsRequest {
  queryStringParameters?: {
    group_id?: string
    account_id?: string
  }
}

/**
 * Request to get products by group ID (used in frontend)
 */
export interface GetProductsRequest {
  group_id: string
}

/**
 * Request to fetch public products with pagination
 */
export interface FetchPublicProductsRequest {
  exclusiveStartKey?: { [key: string]: string }
  limit?: number
}
