import { Product } from '../products'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface HandlerResponse<T = any> {
  statusCode: number
  data?: T
  error?: string
  details?: string
}

export interface CreateProductRequest {
  body: Product
}

export interface UpdateProductRequest {
  body: Product
  pathParameters: {
    group_id: string
    id: string
  }
}

export interface DeleteProductRequest {
  pathParameters: {
    group_id: string
    id: string
  }
}

export interface GetProductRequest {
  pathParameters: {
    group_id: string
    id: string
  }
}

export interface ListProductsRequest {
  queryStringParameters?: {
    group_id?: string
  }
}

export interface ProductResponse {
  message: string
  product: Product
}

export interface DeleteProductResponse {
  message: string
  deletedProduct: Product
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
