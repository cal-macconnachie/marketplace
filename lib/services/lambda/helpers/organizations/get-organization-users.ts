import { User } from "../../handlers/users"
import { queryAll } from "../dynamo-helpers/query"

export const getOrganizationUsers = async ({ orgId }: { orgId: string }): Promise<User[]> => {
  const users = await queryAll<User>({
    tableName: process.env.USERS_TABLE!,
    indexName: "organization_id_index",
    keyConditionExpression: 'organization_id = :orgId',
    expressionAttributeValues: {
      ':orgId': orgId
    }
  })
  return users
}
