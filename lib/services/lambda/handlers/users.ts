import { DynamoDBStreamEvent } from 'aws-lambda'
import { PurchasedProduct } from "./products"
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { AttributeValue } from '@aws-sdk/client-dynamodb'
import Stripe from 'stripe'
import isEqual from 'lodash.isequal'
import { getStripeClient } from '../helpers/stripe/stripe-client'
import { update } from '../helpers/dynamo-helpers/update'

export interface User {
  // basic fields
  id: string
  organization_id: string
  is_organization_admin: boolean
  given_name?: string
  family_name?: string
  name?: string // Full name, can be a combination of given_name and family_name
  cognito_id?: string
  email?: string
  phone_number?: string
  social_provider?: string
  address?: {
    line_1: string
    line_2?: string
    state: string
    city: string
    country: string
    postal_code: string
  }
  ip_address?: string

  // stripe fields
  stripe_id?: string
  stripe_customer_error?: string

  // purchases
  products?: PurchasedProduct[]
  in_good_standing_until?: number // Timestamp until which the user is in good standing
  product_groups?: string[]
}

export const users = async (event: DynamoDBStreamEvent) => {
  // stream handles the creation of stripe customers
  // dont create the stripe customer until we have (name) and (email | phone number)
  const stripe = getStripeClient()
  for (const record of event.Records) {
    const oldUser = record.dynamodb?.OldImage
      ? (unmarshall(record.dynamodb.OldImage as Record<string, AttributeValue>) as User)
      : undefined
    const newUser = record.dynamodb?.NewImage
      ? (unmarshall(record.dynamodb.NewImage as Record<string, AttributeValue>) as User)
      : undefined
    if (newUser == null) continue
    // new user exists
    const userStripeFields: (keyof User)[] = [
      'phone_number',
      'email',
      'name',
      'address',
      'ip_address',
      'given_name',
      'family_name'
    ]
    const shouldCreate = !newUser.stripe_id && !newUser.stripe_customer_error && (newUser.name || (newUser.given_name && newUser.family_name)) && (newUser.phone_number || newUser.email)
    const shouldUpdate = !shouldCreate && newUser.stripe_id && (oldUser != null) && userStripeFields.some(field => oldUser[field] !== newUser[field])
    if (shouldCreate) {
      const params: Stripe.CustomerCreateParams = {
        name: newUser.name || `${newUser.given_name} ${newUser.family_name}`,
        email: newUser.email,
        phone: newUser.phone_number,
        address: newUser.address,
        metadata: {
          user_id: newUser.id,
          organization_id: newUser.organization_id
        }
      }
      if (!isEqual(newUser.address, oldUser?.address ?? {}) && !isEqual(newUser.ip_address, oldUser?.ip_address)) {
        params.tax = {
          ip_address: newUser.ip_address,
          validate_location: 'immediately'
        }
      }
      let customer: Stripe.Customer | undefined
      let error: Error | undefined
      try {
        customer = await stripe.customers.create(params)
      } catch (err) {
        error = err as Error
        console.error('Error creating Stripe customer:', error)
      }
      if (customer) {
        await update<User>({
          tableName: process.env.USERS_TABLE!,
          key: { id: newUser.id },
          updates: {
            stripe_id: customer.id,
            stripe_customer_error: ''
          }
        })
      } else {
        await update<User>({
          tableName: process.env.USERS_TABLE!,
          key: { id: newUser.id },
          updates: {
            stripe_customer_error: error?.message ?? 'Unknown error check logs'
          }
        })
      }
      continue
    }
    if (shouldUpdate) {
      const params: Stripe.CustomerUpdateParams = {
        name: newUser.name || `${newUser.given_name} ${newUser.family_name}`,
        email: newUser.email,
        phone: newUser.phone_number,
        address: newUser.address,
        metadata: {
          user_id: newUser.id,
          organization_id: newUser.organization_id
        }
      }
      if (!isEqual(newUser.address, oldUser?.address ?? {}) && !isEqual(newUser.ip_address, oldUser?.ip_address)) {
        params.tax = {
          ip_address: newUser.ip_address,
          validate_location: 'immediately'
        }
      }
      let error: Error | undefined
      try {
        await stripe.customers.update(newUser.stripe_id!, params)
      } catch (err) {
        error = err as Error
        console.error('Error updating Stripe customer:', error)
      }
      if (error) {
        await update<User>({
          tableName: process.env.USERS_TABLE!,
          key: { id: newUser.id },
          updates: {
            stripe_customer_error: error?.message
          }
        })
      }
    }
  }
}