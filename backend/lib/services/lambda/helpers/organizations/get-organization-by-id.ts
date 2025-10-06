import { organizationsTableName } from '@marketplace/constants'
import { Organization } from '@marketplace/types'
import { get } from '../dynamo-helpers/get'

export const getOrganizationById = async (id: string): Promise<Organization | undefined> => {
  return get<Organization>({
    tableName: organizationsTableName!,
    key: { id }
  })
}