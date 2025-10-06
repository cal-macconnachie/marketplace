import { usersTableName } from '@marketplace/constants'
import { User } from '@marketplace/types'
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
      tableName: usersTableName!,
      key: { id: user.id },
      updates: {
        in_good_standing_until: inGoodStandingUntil ?? ''
      }
    })
  }
}
