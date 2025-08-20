import { AttributeValue } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { DynamoDBStreamEvent } from 'aws-lambda'
import { update } from '../helpers/dynamo-helpers/update'
import Stripe from 'stripe'
import { getStripeClient } from '../helpers/stripe/stripe-client'

export interface Promo {
  type: 'coupon' | 'promotion_code'
  id: string
  persist_update?: boolean
  
  // Common fields
  metadata?: Record<string, string>
  created?: number
  livemode?: boolean
  
  // Coupon-specific fields
  name?: string
  percent_off?: number | null
  amount_off?: number | null
  currency?: string | null
  duration?: 'once' | 'repeating' | 'forever'
  duration_in_months?: number | null
  max_redemptions?: number | null
  redeem_by?: number | null
  times_redeemed?: number
  valid?: boolean
  applies_to?: {
    products?: string[]
  }
  stripeId?: string // Stripe ID for the coupon if applicable
  // Promotion code-specific fields
  code?: string
  coupon?: string | Stripe.Coupon
  customer?: string | null
  expires_at?: number | null
  active?: boolean
  restrictions?: {
    first_time_transaction?: boolean
    minimum_amount?: number | null
    minimum_amount_currency?: string | null
  }
  
  // System fields
  error?: string
  last_processed_at?: string
}

const getChangedAttributes = (
  oldRecord: Promo | undefined,
  newRecord: Promo
): Partial<Promo> => {
  if (!oldRecord) {
    return newRecord
  }

  const changes: Partial<Promo> = {}

  // Common fields
  if (oldRecord.type !== newRecord.type) changes.type = newRecord.type
  if (oldRecord.id !== newRecord.id) changes.id = newRecord.id
  if (oldRecord.persist_update !== newRecord.persist_update) changes.persist_update = newRecord.persist_update
  if (JSON.stringify(oldRecord.metadata) !== JSON.stringify(newRecord.metadata)) changes.metadata = newRecord.metadata
  if (oldRecord.created !== newRecord.created) changes.created = newRecord.created
  if (oldRecord.livemode !== newRecord.livemode) changes.livemode = newRecord.livemode
  if (oldRecord.error !== newRecord.error) changes.error = newRecord.error
  if (oldRecord.last_processed_at !== newRecord.last_processed_at) changes.last_processed_at = newRecord.last_processed_at

  // Coupon-specific fields
  if (oldRecord.name !== newRecord.name) changes.name = newRecord.name
  if (oldRecord.percent_off !== newRecord.percent_off) changes.percent_off = newRecord.percent_off
  if (oldRecord.amount_off !== newRecord.amount_off) changes.amount_off = newRecord.amount_off
  if (oldRecord.currency !== newRecord.currency) changes.currency = newRecord.currency
  if (oldRecord.duration !== newRecord.duration) changes.duration = newRecord.duration
  if (oldRecord.duration_in_months !== newRecord.duration_in_months) changes.duration_in_months = newRecord.duration_in_months
  if (oldRecord.max_redemptions !== newRecord.max_redemptions) changes.max_redemptions = newRecord.max_redemptions
  if (oldRecord.redeem_by !== newRecord.redeem_by) changes.redeem_by = newRecord.redeem_by
  if (oldRecord.times_redeemed !== newRecord.times_redeemed) changes.times_redeemed = newRecord.times_redeemed
  if (oldRecord.valid !== newRecord.valid) changes.valid = newRecord.valid
  if (JSON.stringify(oldRecord.applies_to) !== JSON.stringify(newRecord.applies_to)) changes.applies_to = newRecord.applies_to

  // Promotion code-specific fields
  if (oldRecord.code !== newRecord.code) changes.code = newRecord.code
  if (JSON.stringify(oldRecord.coupon) !== JSON.stringify(newRecord.coupon)) changes.coupon = newRecord.coupon
  if (oldRecord.customer !== newRecord.customer) changes.customer = newRecord.customer
  if (oldRecord.expires_at !== newRecord.expires_at) changes.expires_at = newRecord.expires_at
  if (oldRecord.active !== newRecord.active) changes.active = newRecord.active
  if (JSON.stringify(oldRecord.restrictions) !== JSON.stringify(newRecord.restrictions)) changes.restrictions = newRecord.restrictions

  return changes
}

const updateDatabaseRecord = async (
  tableName: string,
  type: string,
  id: string,
  updates: Partial<Promo>,
  error?: string
): Promise<void> => {
  const updateData: Partial<Promo> = {
    ...updates,
    last_processed_at: new Date().toISOString(),
  }
  
  if (error) {
    updateData.error = error
  } else {
    updateData.error = undefined
  }
  
  // Remove undefined values to prevent DynamoDB marshall errors
  const cleanedUpdateData = Object.entries(updateData).reduce(
    (acc, [
      key,
      value
    ]) => {
      if (value !== undefined) {
        acc[key] = value
      }
      return acc
    },
    {} as Record<string, unknown>
  )
  
  try {
    await update({
      tableName,
      key: {
        type, id 
      },
      updates: cleanedUpdateData
    })
  } catch (dbError) {
    console.error('Failed to update database record:', dbError)
  }
}

const prepareCouponDataForCreate = (record: Promo): Stripe.CouponCreateParams => {
  const fieldsToRemove = [
    'type',
    'persist_update',
    'error',
    'last_processed_at',
    'times_redeemed',
    'valid',
    'created',
    'livemode'
  ] as const
  
  const couponData = { ...record } as Record<string, unknown>
  
  fieldsToRemove.forEach(field => {
    delete couponData[field]
  })
  
  return couponData as Stripe.CouponCreateParams
}

const prepareCouponDataForUpdate = (record: Promo): Stripe.CouponUpdateParams => {
  const fieldsToRemove = [
    'type',
    'id',
    'persist_update',
    'error',
    'last_processed_at',
    'times_redeemed',
    'valid',
    'created',
    'livemode',
    'percent_off',
    'amount_off',
    'currency',
    'duration',
    'duration_in_months',
    'max_redemptions',
    'redeem_by',
    'applies_to'
  ] as const
  
  const couponData = { ...record } as Record<string, unknown>
  
  fieldsToRemove.forEach(field => {
    delete couponData[field]
  })
  
  return couponData as Stripe.CouponUpdateParams
}

const preparePromotionCodeDataForCreate = (record: Promo): Stripe.PromotionCodeCreateParams => {
  const fieldsToRemove = [
    'type',
    'id',
    'persist_update',
    'error',
    'last_processed_at',
    'created',
    'livemode'
  ] as const
  
  const promoData = { ...record } as Record<string, unknown>
  
  fieldsToRemove.forEach(field => {
    delete promoData[field]
  })
  
  return promoData as unknown as Stripe.PromotionCodeCreateParams
}

const preparePromotionCodeDataForUpdate = (record: Promo): Stripe.PromotionCodeUpdateParams => {
  const fieldsToRemove = [
    'type',
    'id',
    'persist_update',
    'error',
    'last_processed_at',
    'created',
    'livemode',
    'code',
    'coupon',
    'customer',
    'expires_at'
  ] as const
  
  const promoData = { ...record } as Record<string, unknown>
  
  fieldsToRemove.forEach(field => {
    delete promoData[field]
  })
  
  return promoData as Stripe.PromotionCodeUpdateParams
}

export const promos = async (event: DynamoDBStreamEvent) => {
  try {
    const stripe = getStripeClient()
    if (process.env.STRIPE_SECRET_KEY == null || process.env.STRIPE_SECRET_KEY === '') {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set')
    }
    
    if (process.env.PROMOS_TABLE == null || process.env.PROMOS_TABLE === '') {
      throw new Error('PROMOS_TABLE environment variable is not set')
    }
    
    const records: Array<{
      eventName: string
      old: Promo | undefined
      new: Promo | undefined
    }> = event.Records.map((record) => {
      const {
        eventName, dynamodb 
      } = record
      const old = dynamodb?.OldImage
        ? (unmarshall(dynamodb.OldImage as Record<string, AttributeValue>) as Promo)
        : undefined
      const newRec = dynamodb?.NewImage
        ? (unmarshall(dynamodb.NewImage as Record<string, AttributeValue>) as Promo)
        : undefined
      
      return {
        eventName: eventName ?? 'UNKNOWN',
        old: old,
        new: newRec
      }
    })

    for (const record of records) {
      const {
        eventName, old, new: newRec 
      } = record
      const promoId = (newRec as Promo)?.id ?? (old as Promo)?.id
      const promoType = (newRec as Promo)?.type ?? (old as Promo)?.type
      
      if (!newRec?.persist_update && [
        'INSERT',
        'MODIFY'
      ].includes(eventName)) continue
      
      try {
        let stripePromo: Stripe.Coupon | Stripe.PromotionCode | undefined
        
        switch (eventName) {
          case 'INSERT':
            if (promoId && newRec) {
              try {
                if (newRec.type === 'coupon') {
                  try {
                    await stripe.coupons.retrieve(promoId)
                    const couponUpdateData = prepareCouponDataForUpdate(newRec)
                    stripePromo = await stripe.coupons.update(promoId, couponUpdateData)
                  } catch (error: unknown) {
                    if (error && typeof error === 'object' && 'code' in error && error.code === 'resource_missing') {
                      const couponCreateData = prepareCouponDataForCreate(newRec)
                      stripePromo = await stripe.coupons.create({
                        ...couponCreateData,
                        id: promoId
                      })
                    } else {
                      throw error
                    }
                  }
                } else if (newRec.type === 'promotion_code') {
                  try {
                    stripePromo = await stripe.promotionCodes.retrieve(promoId)
                    const promoCodeUpdateData = preparePromotionCodeDataForUpdate(newRec)
                    stripePromo = await stripe.promotionCodes.update(promoId, promoCodeUpdateData)
                  } catch (error: unknown) {
                    if (error && typeof error === 'object' && 'code' in error && error.code === 'resource_missing') {
                      const promoCodeCreateData = preparePromotionCodeDataForCreate(newRec)
                      stripePromo = await stripe.promotionCodes.create(promoCodeCreateData)
                    } else {
                      throw error
                    }
                  }
                }
                
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error during INSERT'
                console.error(`Error processing INSERT for promo ${promoId}:`, error)
                
                await updateDatabaseRecord(
                  process.env.PROMOS_TABLE!,
                  promoType,
                  promoId,
                  {
                    persist_update: false,
                    ...(stripePromo?.id && { stripeId: stripePromo.id }),
                  },
                  errorMessage
                )
                continue
              }
            }
            break
            
          case 'MODIFY':
            if (promoId && newRec && old) {
              try {
                if (old.type !== newRec.type || old.id !== newRec.id) {
                  throw new Error('type and id cannot be changed for Stripe promos')
                }
                
                if (newRec.type === 'coupon') {
                  const couponUpdateData = prepareCouponDataForUpdate(newRec)
                  stripePromo = await stripe.coupons.update(promoId, couponUpdateData)
                } else if (newRec.type === 'promotion_code') {
                  const promoCodeUpdateData = preparePromotionCodeDataForUpdate(newRec)
                  stripePromo = await stripe.promotionCodes.update(promoId, promoCodeUpdateData)
                }
                
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error during MODIFY'
                console.error(`Error processing MODIFY for promo ${promoId}:`, error)
                
                await updateDatabaseRecord(
                  process.env.PROMOS_TABLE!,
                  promoType,
                  promoId,
                  {
                    persist_update: false,
                    ...(stripePromo?.id && { stripeId: stripePromo.id }),
                  },
                  errorMessage
                )
                continue
              }
            }
            break
            
          case 'REMOVE':
            if (promoId && old) {
              try {
                if (old.type === 'coupon') {
                  await stripe.coupons.del(promoId)
                } else if (old.type === 'promotion_code') {
                  await stripe.promotionCodes.update(promoId, { active: false })
                }
                
              } catch (error) {
                console.error(`Error processing REMOVE for promo ${promoId}:`, error)
                continue
              }
            }
            break
            
          default:
            console.warn(`Unhandled event type: ${eventName}`)
            continue
        }
        
        if (stripePromo && newRec && [
          'INSERT',
          'MODIFY'
        ].includes(eventName)) {
          const updatedFields: Partial<Promo> = {
            persist_update: false,
            stripeId: stripePromo.id,
            metadata: stripePromo.metadata ?? {},
            created: stripePromo.created,
            livemode: stripePromo.livemode
          }
          
          if (newRec.type === 'coupon' && 'name' in stripePromo) {
            const coupon = stripePromo as Stripe.Coupon
            if (coupon.name !== undefined && coupon.name !== null) updatedFields.name = coupon.name
            if (coupon.percent_off !== undefined) updatedFields.percent_off = coupon.percent_off
            if (coupon.amount_off !== undefined) updatedFields.amount_off = coupon.amount_off
            if (coupon.currency !== undefined) updatedFields.currency = coupon.currency
            if (coupon.duration !== undefined) updatedFields.duration = coupon.duration
            if (coupon.duration_in_months !== undefined) updatedFields.duration_in_months = coupon.duration_in_months
            if (coupon.max_redemptions !== undefined) updatedFields.max_redemptions = coupon.max_redemptions
            if (coupon.redeem_by !== undefined) updatedFields.redeem_by = coupon.redeem_by
            if (coupon.times_redeemed !== undefined) updatedFields.times_redeemed = coupon.times_redeemed
            if (coupon.valid !== undefined) updatedFields.valid = coupon.valid
            if (coupon.applies_to !== undefined) updatedFields.applies_to = coupon.applies_to
            updatedFields.stripeId = coupon.id
          } else if (newRec.type === 'promotion_code' && 'code' in stripePromo) {
            const promotionCode = stripePromo as Stripe.PromotionCode
            if (promotionCode.code !== undefined) updatedFields.code = promotionCode.code
            if (promotionCode.coupon !== undefined) updatedFields.coupon = promotionCode.coupon
            if (typeof promotionCode.customer === 'string') {
              updatedFields.customer = promotionCode.customer
            }
            if (promotionCode.expires_at !== undefined) updatedFields.expires_at = promotionCode.expires_at
            if (promotionCode.active !== undefined) updatedFields.active = promotionCode.active
            if (promotionCode.restrictions !== undefined) updatedFields.restrictions = promotionCode.restrictions
            updatedFields.stripeId = promotionCode.id
          }
          let changedAttributes: Record<string, unknown> = {}
          if (old) {
            changedAttributes = getChangedAttributes(old, {
              ...newRec,
              ...updatedFields
            })
          }
          // Always update stripeId and other essential fields, even if no other attributes changed
          const essentialUpdates = {
            persist_update: false,
            stripeId: stripePromo.id,
            ...changedAttributes
          }
          
          await updateDatabaseRecord(
            process.env.PROMOS_TABLE!,
            newRec.type,
            newRec.id,
            essentialUpdates
          )
        }
        
      } catch (error) {
        console.error(`Unexpected error processing ${eventName} for promo ${promoId}:`, error)
        if (newRec) {
          const errorMessage = error instanceof Error ? error.message : 'Unexpected error'
          await updateDatabaseRecord(
            process.env.PROMOS_TABLE!,
            promoType,
            promoId,
            {
              persist_update: false
            },
            errorMessage
          )
        }
      }
    }
  } catch (error) {
    console.error('Error processing Stripe promo stream:', error)
  }
}