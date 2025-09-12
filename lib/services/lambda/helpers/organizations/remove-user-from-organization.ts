import { v4 } from "uuid"
import { Organization } from "../../handlers/organizations"
import { deleteItem } from "../dynamo-helpers/delete"
import { get } from "../dynamo-helpers/get"
import { update } from "../dynamo-helpers/update"
import { getOrganizationUsers } from "./get-organization-users"
import { create } from "../dynamo-helpers/create"
import { User } from "../../handlers/users"

export const removeUserFromOrganization = async ({
  orgId,
  userId
}: {
  orgId: string
  userId: string
}): Promise<void> => {
  const org = await get<Organization>({
    tableName: process.env.ORGANIZATIONS_TABLE!,
    key: {
      id: orgId
    }
  })
  if (!org) throw new Error("Organization not found")
  // Ensure the user is part of the organization
  const orgUsers = await getOrganizationUsers({ orgId })
  if (!orgUsers.some(user => user.id === userId)) throw new Error("User is not part of the organization")
  const orgSubIds = org.stripe_subscription_ids
  const orgDefaultPaymentMethod = org.default_payment_method
  const orgPurchasedProducts = org.purchased_products
  let isThisUsersSub = false
  if (orgDefaultPaymentMethod != null && orgDefaultPaymentMethod.user_id === userId) {
    // we need to remove the default_payment_method and purchased products
    await update<Organization>({
      tableName: process.env.ORGANIZATIONS_TABLE!,
      key: {
        id: orgId
      },
      updates: {
        default_payment_method: '',
        purchased_products: '',
        stripe_subscription_ids: {}
      }
    })
    isThisUsersSub = true
  }
  if (orgUsers.length === 1) {
    // If this was the last user, we can delete the organization
    await deleteItem({
      tableName: process.env.ORGANIZATIONS_TABLE!,
      key: {
        id: orgId
      }
    })
  }
  // users must have and org so now we create a new org and add the user to it
  const newOrgId = v4()
  await Promise.all([
    create<Organization>({
      tableName: process.env.ORGANIZATIONS_TABLE!,
      key: {
        id: newOrgId
      },
      record: {
        id: newOrgId,
        ...(orgDefaultPaymentMethod && isThisUsersSub ? { default_payment_method: orgDefaultPaymentMethod } : {}),
        ...(orgPurchasedProducts != null && orgPurchasedProducts.length > 0 && isThisUsersSub ? { purchased_products: orgPurchasedProducts } : {}),
        ...(orgSubIds && isThisUsersSub ? { stripe_subscription_ids: orgSubIds } : {}),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    }),
    update<User>({
      tableName: process.env.USERS_TABLE!,
      key: {
        id: userId
      },
      updates: {
        organization_id: newOrgId,
        is_organization_admin: true
      }
    })
  ])
}
