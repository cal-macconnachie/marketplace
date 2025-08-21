import { get } from '../dynamo-helpers/get'
import { Organization } from '../../handlers/organizations'

export const getOrganizationById = async (id: string): Promise<Organization | undefined> => {
  return get<Organization>({
    tableName: process.env.ORGANIZATIONS_TABLE!,
    key: { id }
  })
}