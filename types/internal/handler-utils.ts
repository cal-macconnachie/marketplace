/**
 * Generic handler response wrapper for Lambda functions
 * @internal Backend only
 */
export interface HandlerResponse<T = any> {
  statusCode: number
  data?: T
  error?: string
  details?: string
  headers?: {
    [key: string]: string | number | boolean
  }
}
