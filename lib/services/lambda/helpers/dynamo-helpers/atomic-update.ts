import {
  DynamoDBClient, UpdateItemCommand
} from '@aws-sdk/client-dynamodb'
import {
  marshall
} from '@aws-sdk/util-dynamodb'

const dynamo = new DynamoDBClient({})

/**
 * Atomic update using custom UpdateExpression to avoid race conditions
 */
export async function atomicUpdate({
  tableName,
  key,
  updateExpression,
  expressionAttributeNames,
  expressionAttributeValues,
  conditionExpression
}: {
  tableName: string
  key: Record<string, unknown>
  updateExpression: string
  expressionAttributeNames?: Record<string, string>
  expressionAttributeValues?: Record<string, unknown>
  conditionExpression?: string
}): Promise<void> {
  const command = new UpdateItemCommand({
    TableName: tableName,
    Key: marshall(key, { removeUndefinedValues: true }),
    UpdateExpression: updateExpression,
    ...(expressionAttributeNames ? { ExpressionAttributeNames: expressionAttributeNames } : {}),
    ...(expressionAttributeValues ? { ExpressionAttributeValues: marshall(expressionAttributeValues, { removeUndefinedValues: true }) } : {}),
    ...(conditionExpression ? { ConditionExpression: conditionExpression } : {})
  })

  try {
    await dynamo.send(command)
  } catch (error) {
    console.error('Atomic update failed:', error)
    throw error
  }
}