import {
  DynamoDBClient, PutItemCommand 
} from '@aws-sdk/client-dynamodb'
import { marshall } from '@aws-sdk/util-dynamodb'
import { randomBytes } from 'crypto'
import { Cart } from '../handlers/stripe-platform-event-handler'

const dynamo = new DynamoDBClient({})

const CROCKFORD = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Excludes I, L, O, 0, 1

export function generateShortId(len = 10): string {
  const byteLen = Math.ceil((len * 5) / 8)
  const bytes = randomBytes(byteLen)
  let bits = 0
  let value = 0
  let out = ''
  for (const b of bytes) {
    value = (value << 8) | b
    bits += 8
    while (bits >= 5 && out.length < len) {
      out += CROCKFORD[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  // In the unlikely case out is shorter due to bit packing, pad with extra randomness
  while (out.length < len) {
    const n = randomBytes(1)[0] & 31
    out += CROCKFORD[n]
  }
  return out
}

export async function createPurchaseCart(params: {
  userId: string
  purchases: { [purchaseId: string]: 'pending' | 'completed' | 'failed' }
  maxAttempts?: number
  tableName?: string
  idLength?: number
  paymentMethodId: string
}): Promise<Cart> {
  const {
    userId,
    purchases,
    maxAttempts = 5,
    tableName = process.env.PURCHASE_CARTS_TABLE!,
    idLength = 10,
    paymentMethodId
  } = params

  let attempts = 0

  while (true) {
    attempts += 1
    const id = generateShortId(idLength)
    const cart: Cart = {
      user_id: userId,
      id,
      purchases,
      payment_method_id: paymentMethodId,
      status: 'pending',
      created_at: new Date().toISOString()
    }

    try {
      const command = new PutItemCommand({
        TableName: tableName,
        Item: marshall(cart, { removeUndefinedValues: true }),
        ConditionExpression: 'attribute_not_exists(#id)',
        ExpressionAttributeNames: { '#id': 'id' }
      })
      await dynamo.send(command)
      return cart
    } catch (err: unknown) {
      if (isConditionalCheckFailedException(err)) {
        if (attempts >= maxAttempts) {
          throw new Error('Failed to create unique purchase cart after max attempts')
        }
        // Retry with a new id
        continue
      }
      throw err
    }
  }
}

function isConditionalCheckFailedException(err: unknown): err is { name: string } {
  return typeof err === 'object' && err !== null && 'name' in err && err.name === 'ConditionalCheckFailedException'
}
