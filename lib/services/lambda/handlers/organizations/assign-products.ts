import { APIGatewayProxyEvent } from 'aws-lambda'
import { getOrganizationById } from '../../helpers/organizations/get-organization-by-id'
import { PurchasedProduct } from '../products'
import { update } from '../../helpers/dynamo-helpers/update'
import { Organization } from '../organizations'

export const assignProducts = async (event: APIGatewayProxyEvent) => {
  try {
    const {
      organization_id: organizationId,
      assignments
    }: {
      organization_id: string
      assignments: Array<{
        unique_id: string
        user_id: string
      }>
    } = JSON.parse(event.body || '{}')
    if (organizationId == null || organizationId.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing organization ID'
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    const organization = await getOrganizationById(organizationId)
    if (organization == null) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: 'Organization not found'
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    const purchasedProducts = organization.purchased_products ?? []
    const newPurchasedProducts: PurchasedProduct[] = []
    for (const pp of purchasedProducts) {
      const uniqueId = pp.unique_id
      const assignment = assignments.find(a => a.unique_id === uniqueId)
      if (assignment == null) {
        newPurchasedProducts.push(pp)
        continue
      }
      const newPP: PurchasedProduct = {
        ...pp,
        ...(assignment?.user_id == null ? {} : { user_id: assignment?.user_id })
      }
      newPurchasedProducts.push(newPP)
    } 
    const newOrg = await update<Organization>({
      tableName: process.env.ORGANIZATIONS_TABLE!,
      key: {
        id: organizationId
      },
      updates: {
        purchased_products: newPurchasedProducts
      },
      returnUpdated: true
    })
    return {
      statusCode: 200,
      body: JSON.stringify(newOrg),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to assign products',
        details: (error as Error).message ?? 'Unknown error'
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
}
