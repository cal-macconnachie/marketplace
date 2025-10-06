import {
  DynamoDBClient, ScanCommand 
} from '@aws-sdk/client-dynamodb'
import {
  marshall, unmarshall 
} from '@aws-sdk/util-dynamodb'

const dynamo = new DynamoDBClient({})

export async function scan<T>({
  tableName,
  filterExpression,
  expressionAttributeValues,
  expressionAttributeNames,
  indexName,
  limit,
  exclusiveStartKey
}: {
  tableName: string
  filterExpression?: string
  expressionAttributeValues?: Record<string, unknown>
  expressionAttributeNames?: Record<string, string>
  indexName?: string
  limit?: number
  exclusiveStartKey?: Record<string, unknown>
}): Promise<{ items: T[]; lastEvaluatedKey?: Record<string, unknown> }> {
  // Remove empty string values from expressionAttributeValues and exclusiveStartKey
  if (expressionAttributeValues) {
    Object.keys(expressionAttributeValues).forEach((k) => {
      if ((expressionAttributeValues as Record<string, unknown>)[k] === '') {
        delete (expressionAttributeValues as Record<string, unknown>)[k]
      }
    })
  }
  if (exclusiveStartKey) {
    Object.keys(exclusiveStartKey).forEach((k) => {
      if ((exclusiveStartKey as Record<string, unknown>)[k] === '') {
        delete (exclusiveStartKey as Record<string, unknown>)[k]
      }
    })
  }

  const command = new ScanCommand({
    TableName: tableName,
    FilterExpression: filterExpression,
    ExpressionAttributeValues: expressionAttributeValues
      ? marshall(expressionAttributeValues)
      : undefined,
    ExpressionAttributeNames: expressionAttributeNames,
    IndexName: indexName,
    Limit: limit,
    ExclusiveStartKey: exclusiveStartKey ? marshall(exclusiveStartKey) : undefined
  })

  const result = await dynamo.send(command)
  const items = (result.Items || []).map((item) => unmarshall(item) as T)
  const lastEvaluatedKey = result.LastEvaluatedKey ? unmarshall(result.LastEvaluatedKey) : undefined
  return {
    items,
    lastEvaluatedKey
  }
}

export async function scanAll<T>(params: {
  tableName: string
  filterExpression?: string
  expressionAttributeValues?: Record<string, unknown>
  expressionAttributeNames?: Record<string, string>
  indexName?: string
}): Promise<T[]> {
  let items: T[] = []
  let lastEvaluatedKey: Record<string, unknown> | undefined = undefined
  do {
    const result: { items: T[]; lastEvaluatedKey?: Record<string, unknown> } = await scan<T>({
      ...params,
      exclusiveStartKey: lastEvaluatedKey
    })
    items = items.concat(result.items)
    lastEvaluatedKey = result.lastEvaluatedKey
  } while (lastEvaluatedKey)
  return items
}
