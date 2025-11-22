/**
 * Lambda function endpoint definitions and configuration types
 * Used by CDK stacks to define and create Lambda functions with API Gateway integration
 */

import { TableName } from './dynamodb'

export interface LambdaEndpointDefinition {
  name: string
  handler: string
  description: string
  timeout?: number // Timeout in seconds, default is 30 seconds
  memorySize?: number // Memory size in MB, default is 128 MB
  environment?: string[]
  iamPolicies?: Array<{
    actions: string[]
    resources: string[]
  }>
  queues?: string[] // List of SQS queue names this endpoint interacts with
  apiGw?: {
    path: string // API Gateway path for this endpoint
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
    auth: 'none' | 'apiKey' | 'cognito'
    cors: boolean // Enable CORS for this endpoint
  }
  /**
   * If set, this Lambda will be triggered by the specified SQS queue (event source mapping).
   * Use this for rate-limited/event-driven processing.
   */
  queueEvent?: {
    queueName: string
    batchSize?: number
    enabled?: boolean
    maximumBatchingWindow?: number // New property for maximum batching window in milliseconds
  }
  buckets?: string[] // List of S3 bucket names this endpoint interacts with
  /**
   * If set, this Lambda will be triggered by the specified DynamoDB table stream (event source mapping).
   */
  dynamoStreamEvent?: {
    tableName: TableName
    batchSize?: number
    enabled?: boolean
  }
  /**
   * If set, this Lambda will be triggered by the specified EventBridge event (event source mapping).
   */
  eventBridgeEvent?: {
    detailType: string
    enabled?: boolean
    eventBus?: string // Optional, specify if using a custom event bus
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pattern?: Record<string, any> // Optional event pattern for filtering events
  }

  scheduleEvent?: {
    rate: string // e.g. 'rate(5 minutes)' or 'cron(0 12 * * ? *)'
    enabled?: boolean
  }
  streaming?: boolean // Enable Lambda response streaming for this endpoint
  /**
   * If set, these template files will be bundled with the Lambda function and available at runtime.
   * Paths are relative to lib/services/lambda/templates (supports nested directories).
   * They will be copied into the Lambda bundle preserving the relative directory structure.
   */
  bundleTemplate?: string[] // List of template files to bundle with this specific Lambda
  /**
   * If set to true, uses native dependency bundling (required for packages like Sharp, Canvas, etc.)
   * This enables proper Linux binary compilation for Lambda runtime.
   */
  requiresNativeDeps?: boolean
}
