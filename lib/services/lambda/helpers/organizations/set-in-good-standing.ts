import { User } from "../../handlers/users"
import { update } from "../dynamo-helpers/update"
import { getOrganizationUsers } from "./get-organization-users"

export const setInGoodStanding = async ({
  organizationId,
  inGoodStandingUntil
}: {
  organizationId: string
  inGoodStandingUntil: number | undefined
}) => {
  const orgUsers = await getOrganizationUsers({ orgId: organizationId })
  for (const user of orgUsers) {
    await update<User>({
      tableName: process.env.USERS_TABLE!,
      key: { id: user.id },
      updates: {
        in_good_standing_until: inGoodStandingUntil ?? ''
      }
    })
  }
}
