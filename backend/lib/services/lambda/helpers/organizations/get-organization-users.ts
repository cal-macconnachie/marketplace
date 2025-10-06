import { usersTableName } from '@marketplace/constants'
import { User } from '@marketplace/types'
import { queryAll } from "../dynamo-helpers/query"

export const getOrganizationUsers = async ({ orgId }: { orgId: string }): Promise<User[]> => {
  const users = await queryAll<User>({
    tableName: usersTableName!,
    indexName: "organization_id-index",
    keyConditionExpression: 'organization_id = :orgId',
    expressionAttributeValues: {
      ':orgId': orgId
    }
  })
  return users
}
