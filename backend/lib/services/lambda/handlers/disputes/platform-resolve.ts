import {
  disputesTableName, purchasesTableName
} from '@marketplace/constants'
import {
  Dispute, DisputePlatformResolveRequest, Purchase
} from '@marketplace/types'
import {
  APIGatewayProxyEvent, APIGatewayProxyResult
} from 'aws-lambda'
import { queryDisputesByStatus } from '../../helpers/disputes/query-disputes-by-status'
import { update } from '../../helpers/dynamo-helpers/update'
import { getUserFromEvent } from '../../helpers/get-user-from-event'
import { createNotification } from '../../helpers/notifications/internal-notifications/create-notification'

export const platformResolveDispute = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
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

    // TODO: Check if user has platform admin role
    // For now, we'll assume any authenticated user can access this
    // In production, you should verify user has 'platform_admin' role or similar

    // Parse request body
    const requestBody: DisputePlatformResolveRequest = JSON.parse(event.body || '{}')
    const {
      dispute_id, action, notes 
    } = requestBody

    if (!dispute_id || !action || ![
      'accept',
      'reject'
    ].includes(action)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields or invalid action. Action must be: accept or reject' })
      }
    }

    if (!notes || notes.trim().length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Platform notes are required' })
      }
    }

    // Get dispute from escalated disputes
    const disputesResult = await queryDisputesByStatus({
      status: 'escalated',
      limit: 100
    })

    const dispute = disputesResult.items.find(d => d.id === dispute_id)

    if (!dispute) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Escalated dispute not found' })
      }
    }

    // Validate dispute status
    if (dispute.status !== 'escalated') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Can only resolve escalated disputes. Current status: ${dispute.status}` })
      }
    }

    const now = new Date().toISOString()

    if (action === 'accept') {
      // Accept dispute - refund will be processed by stream handler
      await update<Dispute>({
        tableName: disputesTableName!,
        key: {
          id: dispute_id,
          created_at: dispute.created_at
        },
        updates: {
          status: 'accepted',
          platform_notes: notes.trim(),
          platform_resolved_at: now,
          platform_resolved_by: userId,
          updated_at: now
        }
      })

      // Notify buyer and seller
      await Promise.all([
        createNotification({
          type: 'system',
          user_id: dispute.buyer_user_id,
          title: 'Dispute Resolved - Refund Approved',
          message: 'Our platform team has reviewed and approved your dispute. Your refund will be processed shortly.',
          metadata: {
            dispute_id,
            resolution: 'accepted'
          }
        }),
        createNotification({
          type: 'system',
          user_id: dispute.seller_organization_id, // Should notify org admins
          title: 'Dispute Resolved - Refund Issued',
          message: 'A disputed purchase has been resolved in favor of the buyer. The refund has been issued.',
          metadata: {
            dispute_id,
            resolution: 'accepted'
          }
        })
      ])

    } else {
      // Reject dispute - buyer loses, purchases return to completed
      await update<Dispute>({
        tableName: disputesTableName!,
        key: {
          id: dispute_id,
          created_at: dispute.created_at
        },
        updates: {
          status: 'resolved',
          platform_notes: notes.trim(),
          platform_resolved_at: now,
          platform_resolved_by: userId,
          updated_at: now
        }
      })

      // Update purchases back to completed status
      const updatePromises = dispute.purchase_ids.map(purchaseId =>
        update<Purchase>({
          tableName: purchasesTableName!,
          key: {
            user_id: dispute.buyer_user_id,
            id: purchaseId
          },
          updates: {
            status: 'completed',
            // Keep disputed flag to prevent re-disputing
            dispute_id: dispute_id // Keep reference for history
          }
        })
      )

      await Promise.all(updatePromises)

      // Notify buyer and seller
      await Promise.all([
        createNotification({
          type: 'system',
          user_id: dispute.buyer_user_id,
          title: 'Dispute Resolved - Not Approved',
          message: 'Our platform team has reviewed your dispute. After careful consideration, we have determined that a refund is not warranted in this case.',
          metadata: {
            dispute_id,
            resolution: 'rejected'
          }
        }),
        createNotification({
          type: 'system',
          user_id: dispute.seller_organization_id, // Should notify org admins
          title: 'Dispute Resolved - No Refund Required',
          message: 'A disputed purchase has been resolved in your favor. No refund is required.',
          metadata: {
            dispute_id,
            resolution: 'rejected'
          }
        })
      ])
    }

    const updatedDispute: Dispute = {
      ...dispute,
      status: action === 'accept' ? 'accepted' : 'resolved',
      platform_notes: notes.trim(),
      platform_resolved_at: now,
      platform_resolved_by: userId,
      updated_at: now
    }

    console.log(`Platform resolved dispute ${dispute_id}: ${action} by user ${userId}`)

    return {
      statusCode: 200,
      body: JSON.stringify(updatedDispute)
    }

  } catch (error: unknown) {
    console.error('Error resolving dispute:', error)

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: (error as Error).message || 'Failed to resolve dispute'
      })
    }
  }
}
