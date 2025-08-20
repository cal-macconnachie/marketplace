import { Organization } from "../../handlers/organizations"
import { User } from "../../handlers/users"
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
    tableName: process.env.USERS_TABLE!,
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
      tableName: process.env.ORGANIZATIONS_TABLE!,
      key: {
        id: user.organization_id
      }
    }) : Promise.resolve(undefined),
    get<Organization>({
      tableName: process.env.ORGANIZATIONS_TABLE!,
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
  const userHasActiveSubscription = oldOrg?.stripe_subscription_id && user.stripe_id && oldOrg.purchased_products != null && oldOrg.purchased_products.length > 0 && oldOrg.default_payment_method != null && oldOrg.default_payment_method.user_id === userId
  if (userHasActiveSubscription && !newOrg.stripe_subscription_id && !newOrg.default_payment_method) {
    // transfer the subscription to the new org
    await update<Organization>({
      tableName: process.env.ORGANIZATIONS_TABLE!,
      key: { id: oldOrg.id },
      updates: {
        stripe_subscription_id: '',
        default_payment_method: '',
        purchased_products: ''
      }
    })
    await update<Organization>({
      tableName: process.env.ORGANIZATIONS_TABLE!,
      key: { id: organizationId },
      updates: {
        stripe_subscription_id: oldOrg.stripe_subscription_id,
        default_payment_method: oldOrg.default_payment_method,
        purchased_products: oldOrg.purchased_products
      }
    })
  }
  if (userHasActiveSubscription && oldOrg.stripe_subscription_id != null && newOrg.stripe_subscription_id != null) {
    const stripe = getStripeClient()
    await stripe.subscriptions.cancel(oldOrg.stripe_subscription_id)
    await update<Organization>({
      tableName: process.env.ORGANIZATIONS_TABLE!,
      key: { id: oldOrg.id },
      updates: {
        stripe_subscription_id: '',
        default_payment_method: '',
        purchased_products: ''
      }
    })
  }
  await update<User>({
    tableName: process.env.USERS_TABLE!,
    key: {
      id: userId
    },
    updates: {
      organization_id: organizationId,
      is_organization_admin: admin
    }
  })
}
