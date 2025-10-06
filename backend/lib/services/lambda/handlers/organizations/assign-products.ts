import { purchasedProductsTableName } from '@marketplace/constants'
import { PurchasedProduct } from '@marketplace/types'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { queryAll } from '../../helpers/dynamo-helpers/query'
import { update } from '../../helpers/dynamo-helpers/update'
import { getOrganizationById } from '../../helpers/organizations/get-organization-by-id'

export const assignProducts = async (event: APIGatewayProxyEvent) => {
  try {
    const {
      organization_id: organizationId,
      assignments
    }: {
      organization_id: string
      assignments: Array<{
        id: string
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
      tableName: purchasedProductsTableName!,
      keyConditionExpression: 'organization_id = :orgId',
      expressionAttributeValues: {
        ':orgId': organizationId
      }
    })
    const newPurchasedProducts: PurchasedProduct[] = []
    for (const pp of purchasedProducts) {
      const assignment = assignments.find(a => a.id === pp.id)
      if (assignment == null) {
        newPurchasedProducts.push(pp)
        continue
      }
      await update<PurchasedProduct>({
        tableName: purchasedProductsTableName!,
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
