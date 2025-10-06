import type { Product } from '../../entities/product'
import { HandlerResponse } from '../../internal/handler-utils'
import { CreateProductRequest, DeleteProductRequest, GetProductRequest, ListProductsRequest, UpdateProductRequest } from './requests'

/**
 * Response from product creation or update
 */
export interface ProductResponse {
  message: string
  product: Product
}

/**
 * Response from product deletion
 */
export interface DeleteProductResponse {
  message: string
  deletedProduct: Product
}

/**
 * Response from fetching public products with pagination
 */
export interface FetchPublicProductsResponse {
  message: string
  items: Product[]
  lastEvaluatedKey?: { [key: string]: string }
}



export type CreateProductHandler = (
  request: CreateProductRequest
) => Promise<HandlerResponse<ProductResponse>>
export type UpdateProductHandler = (
  request: UpdateProductRequest
) => Promise<HandlerResponse<ProductResponse>>
export type DeleteProductHandler = (
  request: DeleteProductRequest
) => Promise<HandlerResponse<DeleteProductResponse>>
export type GetProductHandler = (
  request: GetProductRequest
) => Promise<HandlerResponse<Product>>
export type ListProductsHandler = (
  request: ListProductsRequest
) => Promise<HandlerResponse<Product[]>>
