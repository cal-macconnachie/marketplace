import { TransactWriteItem } from '@aws-sdk/client-dynamodb'

export const updatePurchaseStatus = async ({
  cartId,
  userId,
  purchaseId,
  status
}: {
  cartId?: string
  userId: string
  purchaseId: string
  status: 'pending' | 'completed' | 'failed'
}) => {
  const transactions: TransactWriteItem[] = []
  transactions.push({
    Update: {
      TableName: process.env.PURCHASES_TABLE!,
      Key: {
        user_id: { S: userId },
        id: { S: purchaseId }
      },
      UpdateExpression: 'SET #status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': { S: status }
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
}
