import { AttributeValue } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { usersTableName } from '@marketplace/constants'
import {
  User
} from "@marketplace/types"
import { DynamoDBStreamEvent } from 'aws-lambda'
import isEqual from 'lodash.isequal'
import Stripe from 'stripe'
import { update } from '../helpers/dynamo-helpers/update'
import { getStripeClient } from '../helpers/stripe/stripe-client'
import { convertAddressToCodes } from '../helpers/tax/address-code-converter'

const toStripeAddress = (address?: User['address']): Stripe.AddressParam | undefined => {
  if (!address) return undefined

  const normalized = convertAddressToCodes({
    country: address.country,
    state: address.state,
    city: address.city,
    postal_code: address.postal_code
  })

  const state = normalized.state && normalized.state !== 'unknown'
    ? normalized.state
    : address.state
  const country = normalized.country && normalized.country !== 'unknown'
    ? normalized.country
    : address.country

  return {
    line1: address.line_1,
    line2: address.line_2 || undefined,
    city: address.city,
    state,
    country,
    postal_code: address.postal_code
  }
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
        address: toStripeAddress(newUser.address),
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
          tableName: usersTableName!,
          key: { id: newUser.id },
          updates: {
            stripe_id: customer.id,
            stripe_customer_error: ''
          }
        })
      } else {
        await update<User>({
          tableName: usersTableName!,
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
        address: toStripeAddress(newUser.address),
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
          tableName: usersTableName!,
          key: { id: newUser.id },
          updates: {
            stripe_customer_error: error?.message
          }
        })
      }
    }
  }
}
