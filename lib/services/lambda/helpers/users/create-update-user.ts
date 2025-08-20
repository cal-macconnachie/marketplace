import { create } from "../dynamo-helpers/create"
import { get } from "../dynamo-helpers/get"
import { update } from "../dynamo-helpers/update"
import { User } from "../../handlers/users"
import { v4 } from "uuid"
import isEqual from "lodash.isequal"
import { getUserByEmail } from "./get-user-by-email"

export const createUpdateUser = async (userInput: Partial<User>) => {
  if (userInput.email == null) throw new Error('Email is required to create user')
  // get user if exists
  const existingUser = await getUserByEmail(userInput.email)
  let user: User | undefined
  if (existingUser) {
    // create user is not allowed to update the organization id however it must be set
    const userEmail = existingUser.email
    delete userInput.email // remove email from updates to avoid overwriting
    if (userInput.organization_id) delete userInput.organization_id
    if (userInput.is_organization_admin) delete userInput.is_organization_admin
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
    user = await create<User>({
      tableName: process.env.USERS_TABLE!,
      key: { email: userInput.email },
      record: {
        ...userInput,
        email: userInput.email,
        organization_id: userInput.organization_id ?? v4(),
        is_organization_admin: userInput.is_organization_admin ?? true,
        id: v4()
      } satisfies User,
      returnCreated: true
    })
  }
  return user
}
