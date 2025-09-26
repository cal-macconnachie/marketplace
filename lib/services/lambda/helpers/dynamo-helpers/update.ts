import {
  AttributeValue,
  DynamoDBClient, TransactWriteItem, TransactWriteItemsCommand, UpdateItemCommand 
} from '@aws-sdk/client-dynamodb'
import {
  marshall, unmarshall 
} from '@aws-sdk/util-dynamodb'

const dynamo = new DynamoDBClient({})

// Overload signatures
export async function update<T>(params: {
  tableName: string
  key: Record<string, unknown>
  updates: { [K in keyof T]?: T[K] | '' }
  returnUpdated: true
}): Promise<T>
export async function update<T>(params: {
  tableName: string
  key: Record<string, unknown>
  updates: { [K in keyof T]?: T[K] | '' }
  returnUpdated?: false
}): Promise<void>

// Implementation
export async function update<T>({
  tableName,
  key,
  updates,
  returnUpdated = false
}: {
  tableName: string
  key: Record<string, unknown>
  updates: { [K in keyof T]?: T[K] | '' }
  returnUpdated?: boolean
}): Promise<void | T> {
  // Remove key attributes from updates
  Object.keys(updates).forEach((k) => {
    if ((updates as Record<string, unknown>)[k] == null) {
      delete (updates as Record<string, unknown>)[k]
    }
  })
  Object.keys(key).forEach((k) => {
    if ((key as Record<string, unknown>)[k] == null) {
      delete (key as Record<string, unknown>)[k]
    }
  })
  const updateKeys = Object.keys(updates).filter((k) => !Object.keys(key).includes(k))
  if (updateKeys.length === 0) throw new Error('No updates provided or all updates are keys')

  let UpdateExpression = ''
  const ExpressionAttributeNames: Record<string, string> = {}
  const ExpressionAttributeValues: Record<string, unknown> = {}
  const setExpr: string[] = []
  const removeExpr: string[] = []

  for (const k of updateKeys) {
    const v = (updates as Record<string, unknown>)[k]
    const nameKey = `#${k}`
    if (v === '') {
      removeExpr.push(nameKey)
    } else {
      setExpr.push(`${nameKey} = :${k}`)
      ExpressionAttributeValues[`:${k}`] = v
    }
    ExpressionAttributeNames[nameKey] = k
  }

  if (setExpr.length > 0) {
    UpdateExpression += 'SET ' + setExpr.join(', ')
  }
  if (removeExpr.length > 0) {
    if (UpdateExpression) UpdateExpression += ' '
    UpdateExpression += 'REMOVE ' + removeExpr.join(', ')
  }

  const command = new UpdateItemCommand({
    TableName: tableName,
    Key: marshall(key, { removeUndefinedValues: true }),
    UpdateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues:
      Object.keys(ExpressionAttributeValues).length > 0
        ? marshall(ExpressionAttributeValues, { removeUndefinedValues: true })
        : undefined,
    ReturnValues: returnUpdated ? 'ALL_NEW' : undefined
  })
  const result = await dynamo.send(command)
  if (returnUpdated && result.Attributes) {
    return unmarshall(result.Attributes) as T
  }
}

export function updateTransaction<T>(params: {
  tableName: string
  key: Record<string, unknown>
  updates: { [K in keyof T]?: T[K] | '' }
}): TransactWriteItem {
  const command = new TransactWriteItemsCommand({
    TransactItems: [
      {
        Update: {
          TableName: params.tableName,
          Key: marshall(params.key, { removeUndefinedValues: true }),
          UpdateExpression: buildUpdateExpression(params.updates),
          ExpressionAttributeNames: buildExpressionAttributeNames(params.updates),
          ExpressionAttributeValues: buildExpressionAttributeValues(params.updates)
        }
      }
    ]
  })
  return command.input.TransactItems![0]
}

function buildUpdateExpression<T>(updates: { [K in keyof T]?: T[K] | '' }): string {
  const set: string[] = []
  const remove: string[] = []
  for (const [
    key,
    value
  ] of Object.entries(updates)) {
    if (value === '') {
      remove.push(`#${key}`)
    } else {
      set.push(`#${key} = :${key}`)
    }
  }
  const expressions = []
  if (set.length > 0) {
    expressions.push(`SET ${set.join(', ')}`)
  }
  if (remove.length > 0) {
    expressions.push(`REMOVE ${remove.join(', ')}`)
  }
  return expressions.join(' ')
}

function buildExpressionAttributeNames<T>(updates: { [K in keyof T]?: T[K] | '' }): Record<string, string> {
  const names: Record<string, string> = {}
  for (const key of Object.keys(updates)) {
    names[`#${key}`] = key
  }
  return names
}

function buildExpressionAttributeValues<T>(updates: { [K in keyof T]?: T[K] | '' }): Record<string, AttributeValue> {
  const values: Record<string, AttributeValue> = {}
  for (const [
    key,
    value
  ] of Object.entries(updates)) {
    if (value !== '') {
      values[`:${key}`] = marshall({ v: value }, { removeUndefinedValues: true }).v
    }
  }
  return values
}
