import {
  Dispute, DisputeQueryParams, DisputeQueryResponse
} from '@marketplace/types'
import {
  APIGatewayProxyEvent, APIGatewayProxyResult
} from 'aws-lambda'
import { queryDisputesByBuyer } from '../../helpers/disputes/query-disputes-by-buyer'
import { queryDisputesBySeller } from '../../helpers/disputes/query-disputes-by-seller'
import { queryDisputesByStatus } from '../../helpers/disputes/query-disputes-by-status'
import { getUserFromEvent } from '../../helpers/get-user-from-event'

export const getDisputes = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Get authenticated user
    const user = await getUserFromEvent(event)
    const userId = user?.id
    if (!userId || !user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' })
      }
    }

    // Parse request body
    const requestBody: DisputeQueryParams = JSON.parse(event.body || '{}')
    const {
      view, status, limit = 20, lastKey 
    } = requestBody

    if (!view || ![
      'buyer',
      'seller',
      'platform'
    ].includes(view)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid view parameter. Must be: buyer, seller, or platform' })
      }
    }

    let result: { items: Dispute[], lastKey?: Record<string, unknown> }

    switch (view) {
      case 'buyer':
        result = await queryDisputesByBuyer({
          buyerUserId: userId,
          status,
          limit,
          lastKey: lastKey ? JSON.parse(lastKey) : undefined
        })
        break

      case 'seller':
        // Query by seller organization
        if (!user.organization_id) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'User does not belong to an organization' })
          }
        }

        result = await queryDisputesBySeller({
          sellerOrganizationId: user.organization_id,
          status,
          limit,
          lastKey: lastKey ? JSON.parse(lastKey) : undefined
        })
        break

      case 'platform':
        // Platform manager view - show escalated disputes
        // TODO: Add permission check for platform admin role
        result = await queryDisputesByStatus({
          status: status || 'escalated',
          limit,
          lastKey: lastKey ? JSON.parse(lastKey) : undefined
        })
        break

      default:
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Invalid view' })
        }
    }

    const response: DisputeQueryResponse = {
      items: result.items,
      lastKey: result.lastKey ? JSON.stringify(result.lastKey) : undefined
    }

    return {
      statusCode: 200,
      body: JSON.stringify(response)
    }

  } catch (error: unknown) {
    console.error('Error getting disputes:', error)

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: (error as Error).message || 'Failed to get disputes'
      })
    }
  }
}
