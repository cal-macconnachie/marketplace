import {
  DynamoDBClient, PutItemCommand 
} from '@aws-sdk/client-dynamodb'
import { marshall } from '@aws-sdk/util-dynamodb'
import { randomBytes } from 'crypto'

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

export type PurchaseCart = {
  user_id: string
  id: string
  purchases: string[]
}

export async function createPurchaseCart(params: {
  userId: string
  purchaseIds: string[]
  maxAttempts?: number
  tableName?: string
  idLength?: number
}): Promise<PurchaseCart> {
  const {
    userId,
    purchaseIds,
    maxAttempts = 5,
    tableName = process.env.PURCHASE_CARTS_TABLE!,
    idLength = 10
  } = params

  let attempts = 0
   
  while (true) {
    attempts += 1
    const id = generateShortId(idLength)
    const cart: PurchaseCart = {
      user_id: userId, id, purchases: purchaseIds 
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
