import {
  DynamoDBClient,
  TransactWriteItem,
  TransactWriteItemsCommand
} from '@aws-sdk/client-dynamodb'

const dynamo = new DynamoDBClient({})

export async function transactWrite({ items }: { items: TransactWriteItem[] }): Promise<void> {
  if (items.length === 0) {
    throw new Error('TransactWriteItems array cannot be empty')
  }

  if (items.length > 100) {
    throw new Error('TransactWriteItems array cannot exceed 100 items')
  }

  const command = new TransactWriteItemsCommand({
    TransactItems: items
  })

  await dynamo.send(command)
}