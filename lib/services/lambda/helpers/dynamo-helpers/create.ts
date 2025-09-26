import {
  DynamoDBClient, PutItemCommand, 
  TransactWriteItem,
  TransactWriteItemsCommand
} from '@aws-sdk/client-dynamodb'
import { marshall } from '@aws-sdk/util-dynamodb'

const dynamo = new DynamoDBClient({})

// Overload signatures
export async function create<T>(params: {
  tableName: string
  key: Record<string, unknown>
  record: T
  returnCreated: true
}): Promise<T>
export async function create<T>(params: {
  tableName: string
  key: Record<string, unknown>
  record: T
  returnCreated?: false
}): Promise<void>

// Implementation
export async function create<T>({
  tableName,
  key,
  record,
  returnCreated = false
}: {
  tableName: string
  key: Record<string, unknown>
  record: Partial<T>
  returnCreated?: boolean
}): Promise<void | T> {
  // Merge key and updates into a single item
  const item = {
    ...record, ...key 
  }
  // delete any empty string values to avoid issues with DynamoDB
  Object.keys(item).forEach((k) => item[k] === '' && delete item[k])
  const command = new PutItemCommand({
    TableName: tableName,
    Item: marshall(item, { removeUndefinedValues: true }),
    ReturnValues: returnCreated ? 'ALL_OLD' : undefined // DynamoDB only supports 'ALL_OLD' for PutItem
  })
  await dynamo.send(command)
  if (returnCreated) {
    // Since PutItem does not return the new item, return the input item
    return item as T
  }
}

export function createTransaction<T>(params: {
  tableName: string
  record: T
}): TransactWriteItem {
  const command = new TransactWriteItemsCommand({
    TransactItems: [
      {
        Put: {
          TableName: params.tableName,
          Item: marshall(params.record, { removeUndefinedValues: true })
        }
      }
    ]
  })
  return command.input.TransactItems![0]
}