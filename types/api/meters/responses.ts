import type { BillingMeter } from '../../entities/meter'

/**
 * Response from creating a meter
 */
export interface CreateMeterResponse {
  meter: {
    id: string
    display_name: string
    event_name: string
    default_aggregation: {
      formula: string
    }
  }
}

/**
 * Response from meter operations (internal handler format)
 * @internal Backend only
 */
export interface MeterResponse {
  message: string
  meter: BillingMeter
}

/**
 * Response from deactivating a meter
 * @internal Backend only
 */
export interface DeactivateMeterResponse {
  message: string
  meter: BillingMeter
}
