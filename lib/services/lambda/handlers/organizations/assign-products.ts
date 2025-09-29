import { APIGatewayProxyEvent } from 'aws-lambda'
import { getOrganizationById } from '../../helpers/organizations/get-organization-by-id'
import { PurchasedProduct } from '../products'
import { update } from '../../helpers/dynamo-helpers/update'
import { queryAll } from '../../helpers/dynamo-helpers/query'

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
    const purchasedProducts = await queryAll<PurchasedProduct>({
      tableName: process.env.PURCHASED_PRODUCTS_TABLE!,
      keyConditionExpression: 'organization_id = :orgId',
      expressionAttributeValues: {
        ':orgId': organizationId
      }
    })
    const newPurchasedProducts: PurchasedProduct[] = []
    for (const pp of purchasedProducts) {
      const uniqueId = pp.unique_id
      const assignment = assignments.find(a => a.unique_id === uniqueId)
      if (assignment == null) {
        newPurchasedProducts.push(pp)
        continue
      }
      await update<PurchasedProduct>({
        tableName: process.env.PURCHASED_PRODUCTS_TABLE!,
        key: {
          organization_id: organizationId,
          id: pp.id
        },
        updates: {
          user_id: assignment.user_id
        }
      })
    }
    return {
      statusCode: 200,
      body: JSON.stringify(organization),
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
