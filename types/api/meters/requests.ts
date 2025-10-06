import type { BillingMeter } from '../../entities/meter'
import { HandlerResponse } from '../../internal/handler-utils'
import { DeactivateMeterResponse, MeterResponse } from './responses'

/**
 * Request to create a billing meter
 */
export interface CreateMeterRequest {
  display_name: string
  event_name: string
  default_aggregation: {
    formula: 'count' | 'sum'
  }
}

/**
 * Request to create a meter (internal handler format)
 * @internal Backend only
 */
export interface CreateMeterHandlerRequest {
  body: BillingMeter
}

/**
 * Request to list meters
 * @internal Backend only
 */
export interface ListMetersRequest {
  queryStringParameters?: {
    status?: 'active' | 'inactive'
    limit?: string
    account_id?: string
  }
}

/**
 * Request to deactivate a meter
 * @internal Backend only
 */
export interface DeactivateMeterRequest {
  pathParameters: {
    id: string
  }
  queryStringParameters?: {
    account_id?: string
  }
}

export type CreateMeterHandler = (
  request: CreateMeterRequest
) => Promise<HandlerResponse<MeterResponse>>

export type ListMetersHandler = (
  request: ListMetersRequest
) => Promise<HandlerResponse<BillingMeter[]>>

export type DeactivateMeterHandler = (
  request: DeactivateMeterRequest
) => Promise<HandlerResponse<DeactivateMeterResponse>>
