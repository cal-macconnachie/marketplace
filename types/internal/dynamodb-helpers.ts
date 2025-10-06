/**
 * DynamoDB helper function types
 * @internal Backend only
 */

/**
 * Input parameters for queryAll helper function
 */
export interface QueryAllInput {
  tableName: string
  keyConditionExpression: string
  expressionAttributeNames?: Record<string, string>
  expressionAttributeValues?: Record<string, any>
  filterExpression?: string
  indexName?: string
  limit?: number
  projectionExpression?: string
}
