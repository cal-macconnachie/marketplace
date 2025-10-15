import { disputesTableName } from '@marketplace/constants'
import {
  Dispute, DisputeRespondRequest
} from '@marketplace/types'
import {
  APIGatewayProxyEvent, APIGatewayProxyResult
} from 'aws-lambda'
import { queryDisputesBySeller } from '../../helpers/disputes/query-disputes-by-seller'
import { update } from '../../helpers/dynamo-helpers/update'
import { getUserFromEvent } from '../../helpers/get-user-from-event'
import { createNotification } from '../../helpers/notifications/internal-notifications/create-notification'

export const respondToDispute = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Get authenticated user
    const user = await getUserFromEvent(event)
    const userId = user?.id

    if (!userId || !user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    }

    // Parse request body
    const requestBody: DisputeRespondRequest = JSON.parse(event.body || '{}')
    const {
      dispute_id, action, response 
    } = requestBody

    if (!dispute_id || !action || ![
      'accept',
      'reject'
    ].includes(action)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields or invalid action. Action must be: accept or reject' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    }

    if (!response || response.trim().length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Response message is required' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    }

    if (!user.organization_id) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'User does not belong to an organization' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    }

    // Get dispute
    // We need to scan for the dispute since we only have the id, not the created_at
    // Alternative: Store disputes with id as PK only (no sort key)
    // For now, we'll query by seller_organization_id and filter

    const disputesResult = await queryDisputesBySeller({
      sellerOrganizationId: user.organization_id,
      limit: 100 // Increase limit to find the dispute
    })

    const dispute = disputesResult.items.find(d => d.id === dispute_id)

    if (!dispute) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Dispute not found or you do not have permission to respond' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    }

    // Validate dispute status
    if (dispute.status !== 'pending') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Cannot respond to dispute with status: ${dispute.status}` }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    }

    // Verify user's organization matches seller organization
    if (dispute.seller_organization_id !== user.organization_id) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'You do not have permission to respond to this dispute' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    }

    const now = new Date().toISOString()

    // Update dispute based on action
    const newStatus: Dispute['status'] = action === 'accept' ? 'accepted' : 'escalated'

    await update<Dispute>({
      tableName: disputesTableName!,
      key: {
        id: dispute_id,
        created_at: dispute.created_at
      },
      updates: {
        status: newStatus,
        seller_response: response.trim(),
        seller_responded_at: now,
        updated_at: now
      }
    })

    // Send notification to buyer
    try {
      await createNotification({
        type: 'system',
        user_id: dispute.buyer_user_id,
        title: action === 'accept' ? 'Dispute Accepted' : 'Dispute Escalated',
        message: action === 'accept'
          ? `The seller has accepted your dispute. Your refund will be processed shortly.`
          : `The seller has rejected your dispute. It has been escalated to our platform team for review.`,
        metadata: {
          dispute_id,
          seller_response: response.trim(),
          dispute_action: action
        }
      })
    } catch (notificationError) {
      console.error('Failed to send dispute response notification:', notificationError)
      // Don't fail the request if notification fails
    }

    // If rejected/escalated, notify platform manager
    if (action === 'reject') {
      // TODO: Implement platform manager notification
      console.log(`Dispute ${dispute_id} escalated - platform manager should be notified`)
    }

    const updatedDispute: Dispute = {
      ...dispute,
      status: newStatus,
      seller_response: response.trim(),
      seller_responded_at: now,
      updated_at: now
    }

    console.log(`Dispute ${dispute_id} ${action}ed by seller organization ${user.organization_id}`)

    return {
      statusCode: 200,
      body: JSON.stringify(updatedDispute),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    }

  } catch (error) {
    console.error('Error responding to dispute:', error)

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: (error as Error).message || 'Failed to respond to dispute'
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    }
  }
}
