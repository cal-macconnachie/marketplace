import {
  disputesTableName, purchasesTableName
} from '@marketplace/constants'
import {
  Dispute, DisputeCreateRequest, Purchase
} from '@marketplace/types'
import {
  APIGatewayProxyEvent, APIGatewayProxyResult
} from 'aws-lambda'
import { v4 as uuidv4 } from 'uuid'
import { validateDisputeEligibility } from '../../helpers/disputes/validate-dispute-eligibility'
import { create } from '../../helpers/dynamo-helpers/create'
import { update } from '../../helpers/dynamo-helpers/update'
import { getUserFromEvent } from '../../helpers/get-user-from-event'
import { createNotification } from '../../helpers/notifications/internal-notifications/create-notification'

export const createDispute = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Get authenticated user
    const user = await getUserFromEvent(event)
    const userId = user?.id
    if (!userId) {
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
    const requestBody: DisputeCreateRequest = JSON.parse(event.body || '{}')
    const {
      cart_id, purchase_ids, reason 
    } = requestBody

    if (!cart_id || !purchase_ids || purchase_ids.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields: cart_id, purchase_ids' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    }

    if (!reason || reason.trim().length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Dispute reason is required' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    }

    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'User not found' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    }

    // Validate dispute eligibility
    const validation = await validateDisputeEligibility({
      purchaseIds: purchase_ids,
      userId
    })

    // Verify cart_id matches
    if (validation.cartId !== cart_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Provided cart_id does not match purchases' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    }

    // Create dispute record
    const disputeId = uuidv4()
    const now = new Date().toISOString()

    const dispute: Dispute = {
      id: disputeId,
      cart_id,
      purchase_ids,
      buyer_user_id: userId,
      buyer_organization_id: user.organization_id,
      seller_organization_id: validation.sellerOrganizationId,
      reason: reason.trim(),
      status: 'pending',
      total_dispute_amount: validation.totalAmount,
      currency: validation.currency,
      created_at: now,
      updated_at: now
    }

    await create<Dispute>({
      tableName: disputesTableName!,
      key: {
        id: disputeId,
        created_at: now
      },
      record: dispute
    })

    // Update all purchases to mark as disputed
    const updatePromises = purchase_ids.map(purchaseId =>
      update<Purchase>({
        tableName: purchasesTableName!,
        key: {
          user_id: userId,
          id: purchaseId
        },
        updates: {
          status: 'in_dispute',
          disputed: true,
          dispute_id: disputeId
        }
      })
    )

    await Promise.all(updatePromises)

    // Send notification to seller organization
    // Note: This would notify all admin users in the seller organization
    try {
      await createNotification({
        type: 'dispute_created',
        user_id: validation.sellerOrganizationId, // This should be updated to notify org admins
        title: 'New Dispute Received',
        message: `A buyer has disputed ${purchase_ids.length} purchase(s) totaling ${validation.totalAmount / 100} ${validation.currency}`,
        metadata: {
          dispute_id: disputeId,
          cart_id,
          purchase_count: purchase_ids.length.toString(),
          action: 'dispute_created'
        }
      })
    } catch (notificationError) {
      console.error('Failed to send dispute notification:', notificationError)
      // Don't fail the request if notification fails
    }

    console.log(`Dispute ${disputeId} created for ${purchase_ids.length} purchases by user ${userId}`)

    return {
      statusCode: 200,
      body: JSON.stringify(dispute),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    }

  } catch (error: unknown) {
    console.error('Error creating dispute:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to create dispute'

    return {
      statusCode: errorMessage?.includes('not found') ? 404 :
        errorMessage?.includes('already') || errorMessage?.includes('must') ? 400 : 500,
      body: JSON.stringify({
        error: errorMessage
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    }
  }
}
