import { create } from "../dynamo-helpers/create"
import { update } from "../dynamo-helpers/update"
import { User } from "../../handlers/users"
import { v4 } from "uuid"
import isEqual from "lodash.isequal"
import { getUserByEmail } from "./get-user-by-email"
import { Organization } from '../../handlers/organizations'
import { getOrganizationById } from '../organizations/get-organization-by-id'

export const createUpdateUser = async (userInput: Partial<User>) => {
  if (userInput.email == null) throw new Error('Email is required to create user')
  
  // Validate organization_id exists if provided
  if (userInput.organization_id) {
    const organization = await getOrganizationById(userInput.organization_id)
    if (!organization) {
      throw new Error(`Organization with id ${userInput.organization_id} does not exist`)
    }
  }
  
  // get user if exists
  const existingUser = await getUserByEmail(userInput.email)
  let user: User | undefined
  if (existingUser) {
    // create user is not allowed to update the organization id however it must be set
    const userEmail = existingUser.email
    delete userInput.email // remove email from updates to avoid overwriting
    if (userInput.organization_id) delete userInput.organization_id
    if (userInput.is_organization_admin) delete userInput.is_organization_admin

    // Handle cognito_id: only allow setting if it doesn't exist, throw error if it does
    if (userInput.cognito_id) {
      if (existingUser.cognito_id) {
        throw new Error('User already has a Cognito ID and it cannot be updated')
      }
      // cognito_id will be included in the update since existingUser doesn't have one
    }
    // delete very key from userInput that is the same as on th eexisting user
    const userInputKeys: (keyof User)[] = Object.keys(userInput) as (keyof User)[]
    for (const key of userInputKeys) {
      if (isEqual(userInput[key], existingUser[key])) {
        delete userInput[key]
      }
    }
    if (Object.keys(userInput).length === 0) return existingUser
    user = await update<User>({
      tableName: process.env.USERS_TABLE!,
      key: { email: userEmail },
      updates: {
        ...userInput
      },
      returnUpdated: true
    })
  } else {
    const orgId = userInput.organization_id ?? v4()
    user = await create<User>({
      tableName: process.env.USERS_TABLE!,
      key: { email: userInput.email },
      record: {
        ...userInput,
        email: userInput.email,
        organization_id: orgId,
        is_organization_admin: userInput.is_organization_admin ?? true,
        id: v4()
      } satisfies User,
      returnCreated: true
    })
    if (!userInput.organization_id) {
      await create<Organization>({
        tableName: process.env.ORGANIZATIONS_TABLE!,
        key: { id: orgId },
        record: {
          id: orgId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        } satisfies Organization,
        returnCreated: true
      })
    }
  }
  return user
}
