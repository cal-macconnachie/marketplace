import {
  DynamoDBClient, QueryCommand
} from '@aws-sdk/client-dynamodb'
import {
  marshall, unmarshall
} from '@aws-sdk/util-dynamodb'
import type { QueryAllInput } from '@marketplace/types'

const dynamo = new DynamoDBClient({})

export async function query<T>({
  tableName,
  keyConditionExpression,
  expressionAttributeValues,
  expressionAttributeNames,
  filterExpression,
  indexName,
  limit,
  exclusiveStartKey,
  sortOrder = 'DESC'
}: {
  tableName: string
  keyConditionExpression: string
  expressionAttributeValues?: Record<string, unknown>
  expressionAttributeNames?: Record<string, string>
  filterExpression?: string
  indexName?: string
  limit?: number
  exclusiveStartKey?: Record<string, unknown>
  sortOrder?: 'ASC' | 'DESC'
}): Promise<{ items: T[]; lastEvaluatedKey?: Record<string, unknown> }> {
  // Remove empty string values from expressionAttributeValues and exclusiveStartKey
  Object.keys(expressionAttributeValues ?? {}).forEach((k) => {
    if ((expressionAttributeValues as Record<string, unknown>)[k] === '') {
      delete (expressionAttributeValues as Record<string, unknown>)[k]
    }
  })
  if (exclusiveStartKey) {
    Object.keys(exclusiveStartKey).forEach((k) => {
      if ((exclusiveStartKey as Record<string, unknown>)[k] === '') {
        delete (exclusiveStartKey as Record<string, unknown>)[k]
      }
    })
  }
  const command = new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: keyConditionExpression,
    ExpressionAttributeValues: marshall(expressionAttributeValues),
    ExpressionAttributeNames: expressionAttributeNames,
    FilterExpression: filterExpression,
    IndexName: indexName,
    Limit: limit,
    ScanIndexForward: sortOrder === 'ASC' ? true : false,
    ExclusiveStartKey: exclusiveStartKey ? marshall(exclusiveStartKey) : undefined
  })
  const result = await dynamo.send(command)
  const items = (result.Items || []).map((item) => unmarshall(item) as T)
  const lastEvaluatedKey = result.LastEvaluatedKey ? unmarshall(result.LastEvaluatedKey) : undefined
  return {
    items, lastEvaluatedKey 
  }
}
export async function queryAll<T>(params: QueryAllInput): Promise<T[]> {
  let items: T[] = []
  let lastEvaluatedKey: Record<string, unknown> | undefined = undefined
  do {
    const result: { items: T[]; lastEvaluatedKey?: Record<string, unknown> } = await query<T>({
      ...params,
      exclusiveStartKey: lastEvaluatedKey
    })
    items = items.concat(result.items)
    lastEvaluatedKey = result.lastEvaluatedKey
  } while (lastEvaluatedKey)
  return items
}
