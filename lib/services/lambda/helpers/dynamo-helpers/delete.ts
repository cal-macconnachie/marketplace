import { DynamoDBClient, DeleteItemCommand } from '@aws-sdk/client-dynamodb'
import { marshall } from '@aws-sdk/util-dynamodb'

const dynamo = new DynamoDBClient({})

export async function deleteItem({
  tableName,
  key
}: {
  tableName: string
  key: Record<string, unknown>
}): Promise<void> {
  const command = new DeleteItemCommand({
    TableName: tableName,
    Key: marshall(key)
  })
  await dynamo.send(command)
}
