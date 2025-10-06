import { TransactWriteItem } from '@aws-sdk/client-dynamodb'
import { transactWrite } from '../dynamo-helpers/transact-write'

export const updatePurchaseStatus = async ({
  cartId,
  userId,
  purchaseId,
  status,
  destinationChargeId
}: {
  cartId?: string
  userId: string
  purchaseId: string
  status: 'pending' | 'completed' | 'failed'
  destinationChargeId?: string
}) => {
  const transactions: TransactWriteItem[] = []
  const updateExpression = destinationChargeId
    ? 'SET #status = :status, #destinationChargeId = :destinationChargeId'
    : 'SET #status = :status'

  const conditionExpression = (status === 'completed' || status === 'failed')
    ? '#status = :pendingStatus'
    : undefined

  transactions.push({
    Update: {
      TableName: process.env.PURCHASES_TABLE!,
      Key: {
        user_id: { S: userId },
        id: { S: purchaseId }
      },
      UpdateExpression: updateExpression,
      ...(conditionExpression && { ConditionExpression: conditionExpression }),
      ExpressionAttributeNames: {
        '#status': 'status',
        ...destinationChargeId ? { '#destinationChargeId': 'destination_charge_id' } : {}
      },
      ExpressionAttributeValues: {
        ':status': { S: status },
        ...destinationChargeId ? { ':destinationChargeId': { S: destinationChargeId } } : {},
        ...(conditionExpression && { ':pendingStatus': { S: 'pending' } })
      }
    }
  })
  if (cartId) {
    transactions.push({
      Update: {
        TableName: process.env.PURCHASE_CARTS_TABLE!,
        Key: {
          user_id: { S: userId },
          id: { S: cartId }
        },
        UpdateExpression: 'SET purchases.#purchaseId = :status',
        ExpressionAttributeNames: {
          '#purchaseId': purchaseId
        },
        ExpressionAttributeValues: {
          ':status': { S: status }
        }
      }
    })
  }
  await transactWrite({ items: transactions })
}
