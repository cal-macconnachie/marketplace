import { organizationsTableName } from '@marketplace/constants'
import { Organization } from '@marketplace/types'
import isEqual from 'lodash.isequal'
import { v4 } from 'uuid'
import { create } from '../dynamo-helpers/create'
import { get } from '../dynamo-helpers/get'
import { update } from '../dynamo-helpers/update'

export const createUpdateOrganization = async (org: Partial<Organization>): Promise<Organization> => {
  let existingOrg: Organization | undefined
  if (org.id != null) {
    existingOrg = await get<Organization>({
      tableName: organizationsTableName!,
      key: {
        id: org.id
      }
    })
  }
  let finalOrg: Organization | undefined
  if (existingOrg) {
    const orgKeys: (keyof Organization)[] = Object.keys(org) as (keyof Organization)[]
    for (const key of orgKeys) {
      if (isEqual(org[key], existingOrg[key])) {
        delete org[key]
      }
    }
    if (Object.keys(org).length === 0) return existingOrg
    finalOrg = await update<Organization>({
      tableName: organizationsTableName!,
      key: {
        id: org.id
      },
      updates: {
        ...existingOrg,
        ...org
      },
      returnUpdated: true
    })
  } else {
    finalOrg = await create<Organization>({
      tableName: organizationsTableName!,
      key: {
        id: org.id
      },
      record: {
        ...org,
        id: org.id ?? v4(),
        created_at: new Date().toISOString()
      },
      returnCreated: true
    })
  }
  return finalOrg
}