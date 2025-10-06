import {
  organizationsTableName, usersTableName
} from '@marketplace/constants'
import {
  Organization, User
} from '@marketplace/types'
import { get } from "../dynamo-helpers/get"
import { update } from "../dynamo-helpers/update"
import { getStripeClient } from "../stripe/stripe-client"

export const addUserToOrganization = async ({
  userId,
  organizationId,
  admin = false
}: {
  userId: string
  organizationId: string
  admin?: boolean
}) => {
  // ensure user exists
  const user = await get<User>({
    tableName: usersTableName!,
    key: {
      id: userId
    }
  })
  if (!user) {
    throw new Error("User not found")
  }
  // check org exists
  const [
    oldOrg,
    newOrg
  ] = await Promise.all([
    user.organization_id ? get<Organization>({
      tableName: organizationsTableName!,
      key: {
        id: user.organization_id
      }
    }) : Promise.resolve(undefined),
    get<Organization>({
      tableName: organizationsTableName!,
      key: {
        id: organizationId
      }
    })
  ])
  if (!newOrg) {
    throw new Error("Organization not found")
  }
  /* edge case
    User is an admin who currently has another org they are the paying user for
    1. if new org doesnt have a stripe set up we can transfer the old one
    2. if new org does have a stripe set up we need to cancel the old subscription
  */
  const oldOrgHasSubscriptions = oldOrg && oldOrg.stripe_subscription_ids && Object.keys(oldOrg.stripe_subscription_ids).length > 0
  const userHasActiveSubscription = oldOrgHasSubscriptions && user.stripe_id && oldOrg.default_payment_method != null && oldOrg.default_payment_method.user_id === userId
  
  const newOrgHasSubscriptions = newOrg.stripe_subscription_ids && Object.keys(newOrg.stripe_subscription_ids).length > 0
  
  if (userHasActiveSubscription && !newOrgHasSubscriptions && !newOrg.default_payment_method) {
    // transfer the subscription to the new org
    await update<Organization>({
      tableName: organizationsTableName!,
      key: { id: oldOrg.id },
      updates: {
        stripe_subscription_ids: {},
        default_payment_method: ''
      }
    })
    await update<Organization>({
      tableName: organizationsTableName!,
      key: { id: organizationId },
      updates: {
        stripe_subscription_ids: oldOrg.stripe_subscription_ids || {},
        default_payment_method: oldOrg.default_payment_method
      }
    })
  }
  if (userHasActiveSubscription && newOrgHasSubscriptions) {
    const stripe = getStripeClient()
    
    // Cancel all subscriptions from old org
    if (oldOrg.stripe_subscription_ids) {
      for (const [
        ,
        subscriptionId
      ] of Object.entries(oldOrg.stripe_subscription_ids)) {
        await stripe.subscriptions.cancel(subscriptionId)
      }
    }
    
    await update<Organization>({
      tableName: organizationsTableName!,
      key: { id: oldOrg.id },
      updates: {
        stripe_subscription_ids: {},
        default_payment_method: ''
      }
    })
  }
  await update<User>({
    tableName: usersTableName!,
    key: {
      id: userId
    },
    updates: {
      organization_id: organizationId,
      is_organization_admin: admin
    }
  })
}
