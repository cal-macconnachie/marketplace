// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface HandlerResponse<T = any> {
  statusCode: number
  data?: T
  error?: string
  details?: string
  headers?: {
    [key: string]: string | number | boolean
  }
}

export interface BillingMeter {
  id?: string
  display_name: string
  event_name: string
  default_aggregation: {
    formula: 'sum' | 'count' | 'last'
  }
  status?: 'active' | 'inactive'
  created?: number
  updated?: number
  account_id?: string
}

export interface CreateMeterRequest {
  body: BillingMeter
}

export interface ListMetersRequest {
  queryStringParameters?: {
    status?: 'active' | 'inactive'
    limit?: string
    account_id?: string
  }
}

export interface DeactivateMeterRequest {
  pathParameters: {
    id: string
  }
  queryStringParameters?: {
    account_id?: string
  }
}

export interface MeterResponse {
  message: string
  meter: BillingMeter
}

export type CreateMeterHandler = (
  request: CreateMeterRequest
) => Promise<HandlerResponse<MeterResponse>>

export type ListMetersHandler = (
  request: ListMetersRequest
) => Promise<HandlerResponse<BillingMeter[]>>

export type DeactivateMeterHandler = (
  request: DeactivateMeterRequest
) => Promise<HandlerResponse<{ message: string; meter: BillingMeter }>>