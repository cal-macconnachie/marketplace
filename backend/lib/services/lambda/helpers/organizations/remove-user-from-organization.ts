import {
  organizationsTableName, usersTableName
} from '@marketplace/constants'
import {
  Organization, User
} from '@marketplace/types'
import { v4 } from "uuid"
import { create } from "../dynamo-helpers/create"
import { deleteItem } from "../dynamo-helpers/delete"
import { get } from "../dynamo-helpers/get"
import { update } from "../dynamo-helpers/update"
import { getOrganizationUsers } from "./get-organization-users"

export const removeUserFromOrganization = async ({
  orgId,
  userId
}: {
  orgId: string
  userId: string
}): Promise<void> => {
  const org = await get<Organization>({
    tableName: organizationsTableName!,
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
  let isThisUsersSub = false
  if (orgDefaultPaymentMethod != null && orgDefaultPaymentMethod.user_id === userId) {
    // we need to remove the default_payment_method and purchased products
    await update<Organization>({
      tableName: organizationsTableName!,
      key: {
        id: orgId
      },
      updates: {
        default_payment_method: '',
        stripe_subscription_ids: {}
      }
    })
    isThisUsersSub = true
  }
  if (orgUsers.length === 1) {
    // If this was the last user, we can delete the organization
    await deleteItem({
      tableName: organizationsTableName!,
      key: {
        id: orgId
      }
    })
  }
  // users must have and org so now we create a new org and add the user to it
  const newOrgId = v4()
  await Promise.all([
    create<Organization>({
      tableName: organizationsTableName!,
      key: {
        id: newOrgId
      },
      record: {
        id: newOrgId,
        ...(orgDefaultPaymentMethod && isThisUsersSub ? { default_payment_method: orgDefaultPaymentMethod } : {}),
        ...(orgSubIds && isThisUsersSub ? { stripe_subscription_ids: orgSubIds } : {}),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    }),
    update<User>({
      tableName: usersTableName!,
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
