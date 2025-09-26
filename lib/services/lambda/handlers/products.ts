import { AttributeValue } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { DynamoDBStreamEvent } from 'aws-lambda'
import Stripe from 'stripe'
import { update } from '../helpers/dynamo-helpers/update'
export interface Product {
  group_id: string
  id: string
  organization_id: string
  name: string
  description: string
  active: boolean
  metadata?: Record<string, string>
  tax_code?: string
  images?: string[]
  default_price_data: {
    currency: string
    unit_amount: number
    recurring?: {
      interval: 'day' | 'week' | 'month' | 'year'
      interval_count?: number
      usage_type?: 'licensed' | 'metered'
    }
    meter?: string // Billing meter ID for usage-based pricing
    tax_behavior?: 'exclusive' | 'inclusive' | 'unspecified'
  }
  marketing_features?: {
    name: string
  }[]
  statement_descriptor?: string
  persist_update: boolean
  price_id?: string // Optional, used for linking to a price if applicable
  error?: string // Error message from Stripe operations
  last_processed_at?: string // ISO timestamp of last processing
  price_version?: number // Version number for price changes
  account_id: string // ID of the Stripe account associated with the product
}

export type PurchasedProduct = Pick<Product, 'id' | 'group_id' | 'name' | 'metadata'> & {
  unique_id: string
  user_id?: string
  in_good_standing_until?: number
  amount: number
  currency: string
  purchase_id: string
  subscription_id: string
  subscription_item_id: string
}

let stripe: Stripe | undefined

const getChangedAttributes = (
  oldRecord: Product | undefined,
  newRecord: Product
): Partial<Product> => {
  if (!oldRecord) {
    return newRecord
  }

  const changes: Partial<Product> = {}

  if (oldRecord.name !== newRecord.name) changes.name = newRecord.name
  if (oldRecord.description !== newRecord.description) changes.description = newRecord.description
  if (oldRecord.active !== newRecord.active) changes.active = newRecord.active
  if (JSON.stringify(oldRecord.metadata) !== JSON.stringify(newRecord.metadata))
    changes.metadata = newRecord.metadata
  if (oldRecord.tax_code !== newRecord.tax_code) changes.tax_code = newRecord.tax_code
  if (JSON.stringify(oldRecord.images) !== JSON.stringify(newRecord.images))
    changes.images = newRecord.images
  if (JSON.stringify(oldRecord.default_price_data) !== JSON.stringify(newRecord.default_price_data))
    changes.default_price_data = newRecord.default_price_data
  if (JSON.stringify(oldRecord.marketing_features) !== JSON.stringify(newRecord.marketing_features))
    changes.marketing_features = newRecord.marketing_features
  if (oldRecord.statement_descriptor !== newRecord.statement_descriptor)
    changes.statement_descriptor = newRecord.statement_descriptor
  if (oldRecord.persist_update !== newRecord.persist_update)
    changes.persist_update = newRecord.persist_update

  return changes
}
// Helper function to compare price data
const isPriceDataChanged = (oldRecord: Product | undefined, newRecord: Product): boolean => {
  if (!oldRecord || !oldRecord.default_price_data) return true
  
  const oldPrice = oldRecord.default_price_data
  const newPrice = newRecord.default_price_data
  
  return (
    oldPrice.currency !== newPrice.currency ||
    oldPrice.unit_amount !== newPrice.unit_amount ||
    oldPrice.tax_behavior !== newPrice.tax_behavior ||
    JSON.stringify(oldPrice.recurring) !== JSON.stringify(newPrice.recurring)
  )
}

// Helper function to create a new price
const createStripePrice = async (
  stripe: Stripe,
  productId: string,
  priceData: Product['default_price_data'],
  accountId: string
): Promise<Stripe.Price> => {
  const priceParams: Stripe.PriceCreateParams = {
    product: productId,
    currency: priceData.currency,
    unit_amount: priceData.unit_amount,
    tax_behavior: priceData.tax_behavior,
  }
  
  if (priceData.recurring) {
    priceParams.recurring = {
      interval: priceData.recurring.interval,
      interval_count: priceData.recurring.interval_count,
    }
    
    // Handle usage-based (metered) pricing
    if (priceData.recurring.usage_type === 'metered') {
      priceParams.recurring.usage_type = 'metered'
      
      // If a meter is specified, link it to the price
      if (priceData.meter) {
        priceParams.recurring.meter = priceData.meter
      }
    }
  }

  if (priceData.recurring == null) {
    return await stripe.prices.create(priceParams, { stripeAccount: accountId })
  } else {
    return await stripe.prices.create(priceParams)
  }
}

// Helper function to archive a price
const archiveStripePrice = async (stripe: Stripe, priceId: string, accountId: string): Promise<void> => {
  try {
    await stripe.prices.update(priceId, { active: false }, {
      stripeAccount: accountId
    })
  } catch (error) {
    console.warn(`Failed to archive price ${priceId}:`, error)
    // Don't throw - archiving old price is not critical
  }
}

// Helper function to prepare product data for Stripe API
const prepareProductDataForCreate = (record: Product): Stripe.ProductCreateParams => {
  const fieldsToRemove = [
    'group_id',
    'persist_update',
    'default_price_data',
    'price_id',
    'error',
    'last_processed_at',
    'price_version',
    'account_id',
    'organization_id'
  ] as const
  const productData = { ...record } satisfies Stripe.ProductCreateParams
  productData.metadata = {
    organization_id: record.organization_id
  }
  
  // Remove fields that don't belong in Stripe Product API
  fieldsToRemove.forEach(field => {
    delete productData[field]
  })
  
  // Keep id for create operation to set our own IDs
  
  return productData
}

// Helper function to prepare product data for update
const prepareProductDataForUpdate = (record: Product): Stripe.ProductUpdateParams => {
  const fieldsToRemove = [
    'group_id',
    'id',
    'persist_update',
    'default_price_data',
    'price_id',
    'error',
    'last_processed_at',
    'price_version',
    'account_id',
    'organization_id'
  ] as const
  const productData = { ...record } as Record<string, unknown>
  productData.metadata = {
    organization_id: record.organization_id
  }
  
  // Remove fields that don't belong in Stripe Product API
  fieldsToRemove.forEach(field => {
    delete productData[field]
  })
  
  return productData as Stripe.ProductUpdateParams
}

// Helper function to safely update database with error handling
const updateDatabaseRecord = async (
  tableName: string,
  group_id: string,
  id: string,
  updates: Partial<Product>,
  error?: string
): Promise<void> => {
  const updateData: Partial<Product> = {
    ...updates,
    last_processed_at: new Date().toISOString(),
  }
  
  if (error) {
    updateData.error = error
  } else {
    updateData.error = undefined // Clear any previous errors
  }
  
  try {
    await update({
      tableName,
      key: {
        group_id, id
      },
      updates: updateData
    })
  } catch (dbError) {
    console.error('Failed to update database record:', dbError)
    // Don't throw - we don't want database update failures to break the stream
  }
}

// requires STRIPE_SECRET_KEY and PRODUCTS_TABLE environment variables
export const handler = async (event: DynamoDBStreamEvent) => {
  try {
    if (process.env.STRIPE_SECRET_KEY == null || process.env.STRIPE_SECRET_KEY === '') {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set')
    }
    if (stripe == null) {
      stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    }
    
    if (process.env.PRODUCTS_TABLE == null || process.env.PRODUCTS_TABLE === '') {
      throw new Error('PRODUCTS_TABLE environment variable is not set')
    }
    
    const records: Array<{
      eventName: string
      old: Product | undefined
      new: Product | undefined
    }> = event.Records.map((record) => {
      const {
        eventName, dynamodb 
      } = record
      const old = dynamodb?.OldImage
        ? (unmarshall(dynamodb.OldImage as Record<string, AttributeValue>) as Product)
        : undefined
      const newRec = dynamodb?.NewImage
        ? (unmarshall(dynamodb.NewImage as Record<string, AttributeValue>) as Product)
        : undefined
      
      // ensure tax_code is always set
      if (newRec && !newRec.tax_code) {
        newRec.tax_code = 'txcd_10103001'
      }
      if (old && !old.tax_code) {
        old.tax_code = 'txcd_10103001'
      }
      
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
      const productId = (newRec as Product)?.id ?? (old as Product)?.id
      
      // Skip if persist_update is false for modify or create events
      if (!newRec?.persist_update && [
        'INSERT',
        'MODIFY'
      ].includes(eventName)) continue
      
      // Process each record with individual error handling
      try {
        let stripeProduct: Stripe.Product | undefined
        let newPriceId: string | undefined
        
        switch (eventName) {
          case 'INSERT':
            if (productId && newRec) {
              try {
                // Prepare product data for creation
                const productCreateData = prepareProductDataForCreate(newRec)
                
                // Check if product already exists
                try {
                  await stripe.products.retrieve(productId)
                  // Product exists, update it instead (including unarchiving if needed)
                  const productUpdateData = prepareProductDataForUpdate(newRec)
                  if (newRec.default_price_data.recurring == null) {
                    stripeProduct = await stripe.products.update(productId, {
                      ...productUpdateData,
                      active: true // Ensure it's unarchived
                    }, { stripeAccount: newRec.account_id })
                  } else {
                    stripeProduct = await stripe.products.update(productId, {
                      ...productUpdateData,
                      active: true // Ensure it's unarchived
                    })
                  }
                } catch (error: unknown) {
                  if (error && typeof error === 'object' && 'code' in error && error.code === 'resource_missing') {
                    // Product doesn't exist, create it
                    if (newRec.default_price_data.recurring == null) {
                      stripeProduct = await stripe.products.create({
                        ...productCreateData,
                        id: productId
                      }, { stripeAccount: newRec.account_id })
                    } else {
                      stripeProduct = await stripe.products.create({
                        ...productCreateData,
                        id: productId
                      })
                    }
                  } else {
                    throw error
                  }
                }
                
                // Handle price creation
                if (stripeProduct && newRec.default_price_data) {
                  const newPrice = await createStripePrice(stripe, stripeProduct.id, newRec.default_price_data, newRec.account_id)
                  newPriceId = newPrice.id
                  
                  // Update product with new default price
                  if (newRec.default_price_data.recurring == null) {
                    stripeProduct = await stripe.products.update(stripeProduct.id, {
                      default_price: newPrice.id
                    }, { stripeAccount: newRec.account_id })
                  } else {
                    stripeProduct = await stripe.products.update(stripeProduct.id, {
                      default_price: newPrice.id
                    })
                  }
                }
                
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error during INSERT'
                console.error(`Error processing INSERT for product ${productId}:`, error)
                
                // Store error in database
                await updateDatabaseRecord(
                  process.env.PRODUCTS_TABLE!,
                  newRec.group_id,
                  productId,
                  { persist_update: false },
                  errorMessage
                )
                continue
              }
            }
            break
            
          case 'MODIFY':
            if (productId && newRec && old) {
              try {
                // Check if group_id or id changed (not allowed)
                if (old.group_id !== newRec.group_id || old.id !== newRec.id) {
                  throw new Error('group_id and id cannot be changed for Stripe products')
                }
                
                // Check if price data changed
                const priceChanged = isPriceDataChanged(old, newRec)
                let currentPriceVersion = (old.price_version || 0)
                
                if (priceChanged) {
                  // Create new price
                  const newPrice = await createStripePrice(stripe, productId, newRec.default_price_data, newRec.account_id)
                  newPriceId = newPrice.id
                  currentPriceVersion += 1
                  
                  // Archive old price if it exists
                  if (old.price_id) {
                    await archiveStripePrice(stripe, old.price_id, old.account_id)
                  }
                  
                  // Update product with new default price
                  if (newRec.default_price_data.recurring == null) {
                    await stripe.products.update(productId, {
                      default_price: newPrice.id
                    }, { stripeAccount: newRec.account_id })
                  } else {
                    await stripe.products.update(productId, {
                      default_price: newPrice.id
                    })
                  }
                }
                
                // Update product with non-price fields
                const productUpdateData = prepareProductDataForUpdate(newRec)
                if (newRec.default_price_data.recurring == null) {
                  stripeProduct = await stripe.products.update(productId, productUpdateData, { stripeAccount: newRec.account_id })
                } else {
                  stripeProduct = await stripe.products.update(productId, productUpdateData)
                }
                
                // Update price version if price changed
                if (priceChanged) {
                  newRec.price_version = currentPriceVersion
                }
                
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error during MODIFY'
                console.error(`Error processing MODIFY for product ${productId}:`, error)
                
                // Store error in database
                await updateDatabaseRecord(
                  process.env.PRODUCTS_TABLE!,
                  newRec.group_id,
                  productId,
                  { persist_update: false },
                  errorMessage
                )
                continue
              }
            }
            break
            
          case 'REMOVE':
            if (productId && old) {
              try {
                // Archive the product instead of deleting it
                if (old.default_price_data.recurring == null) {
                  await stripe.products.update(productId, {
                    active: false
                  }, { stripeAccount: old.account_id })
                } else {
                  await stripe.products.update(productId, {
                    active: false
                  })
                }
                
                // Archive the associated price if it exists
                if (old.price_id) {
                  await archiveStripePrice(stripe, old.price_id, old.account_id)
                }
                
              } catch (error) {
                console.error(`Error processing REMOVE for product ${productId}:`, error)
                // For REMOVE operations, we can't update the database since the record is being deleted
                // Just log the error and continue
                continue
              }
            }
            break
            
          default:
            console.warn(`Unhandled event type: ${eventName}`)
            continue
        }
        
        // Update the database record with success data
        if (stripeProduct && newRec && [
          'INSERT',
          'MODIFY'
        ].includes(eventName)) {
          const updatedFields: Partial<Product> = {
            persist_update: false, // Reset persist_update after processing
            id: stripeProduct.id,
            name: stripeProduct.name,
            description: stripeProduct.description ?? '',
            active: stripeProduct.active,
            metadata: stripeProduct.metadata,
            statement_descriptor: stripeProduct.statement_descriptor ?? '',
          }
          
          // Update price_id if a new price was created
          if (newPriceId) {
            updatedFields.price_id = newPriceId
          } else if (typeof stripeProduct.default_price === 'string') {
            updatedFields.price_id = stripeProduct.default_price
          } else if (stripeProduct.default_price?.id) {
            updatedFields.price_id = stripeProduct.default_price.id
          }
          
          // Include price_version if it was updated
          if (newRec.price_version !== undefined) {
            updatedFields.price_version = newRec.price_version
          }
          
          // Only update fields that have changed
          const changedAttributes = getChangedAttributes(old, {
            ...newRec,
            ...updatedFields
          })
          
          if (Object.keys(changedAttributes).length > 0) {
            await updateDatabaseRecord(
              process.env.PRODUCTS_TABLE!,
              newRec.group_id,
              stripeProduct.id,
              changedAttributes
            )
          }
        }
        
      } catch (error) {
        console.error(`Unexpected error processing ${eventName} for product ${productId}:`, error)
        // This is a catch-all for any errors we didn't handle above
        if (newRec) {
          const errorMessage = error instanceof Error ? error.message : 'Unexpected error'
          await updateDatabaseRecord(
            process.env.PRODUCTS_TABLE!,
            newRec.group_id,
            productId,
            { persist_update: false },
            errorMessage
          )
        }
      }
    }
  } catch (error) {
    console.error('Error processing Stripe product stream:', error)
    // Don't throw - we don't want the entire stream to fail
  }
}