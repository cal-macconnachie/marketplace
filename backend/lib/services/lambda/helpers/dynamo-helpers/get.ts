import {
  DynamoDBClient, GetItemCommand 
} from '@aws-sdk/client-dynamodb'
import {
  marshall, unmarshall 
} from '@aws-sdk/util-dynamodb'

const dynamo = new DynamoDBClient({})

export async function get<T>({
  tableName,
  key
}: {
  tableName: string
  key: Record<string, unknown>
}): Promise<T | undefined> {
  // Remove empty string values from key
  if (!tableName) {
    console.warn(
      '[DDB GET] Key contains undefined values:',
      JSON.stringify(key),
      'Table:',
      tableName
    )
    throw new Error('Table name is required')
  }
  if (!key || Object.keys(key).length === 0) {
    console.warn(
      '[DDB GET] Key contains undefined values:',
      JSON.stringify(key),
      'Table:',
      tableName
    )
    throw new Error('Key is required and cannot be empty')
  }
  if (Object.keys(key).some((k) => key[k] === undefined)) {
    console.warn(
      '[DDB GET] Key contains undefined values:',
      JSON.stringify(key),
      'Table:',
      tableName
    )
    throw new Error('Key cannot contain undefined values')
  }
  Object.keys(key).forEach((k) => {
    if ((key as Record<string, unknown>)[k] === '') {
      delete (key as Record<string, unknown>)[k]
    }
  })
  const command = new GetItemCommand({
    TableName: tableName,
    Key: marshall(key, { removeUndefinedValues: true })
  })
  const result = await dynamo.send(command)
  if (!result.Item) return undefined
  return unmarshall(result.Item) as T
}
