/**
 * S3 bucket definitions and configuration types
 * Used by CDK stacks to define and create S3 buckets
 */

export interface S3BucketDefinition {
  bucketName: string
  /** If true, skip adding environment prefix (for buckets that already include env in their name) */
  skipEnvPrefix?: boolean
  description?: string
  allowedFileTypes?: string[]
  lifecycleRules?: {
    id?: string
    enabled?: boolean
    prefix?: string
    expirationInDays?: number
    expirationInMinutes?: number
    transitions?: Array<{
      storageClass: string
      transitionInDays: number
    }>
  }[]
  encryption?: 'AES256' | 'aws:kms' | 'NONE'
  versioning?: boolean
  tags?: Record<string, string>
  corsRules?: Array<{
    allowedMethods: string[]
    allowedOrigins: string[]
    allowedHeaders?: string[]
    exposeHeaders?: string[]
    maxAgeSeconds?: number
  }>
  logging?: {
    targetBucket: string
    targetPrefix?: string
  }
  notification?: {
    lambdaFunctionArn?: string
    events?: string[]
    filterPrefix?: string
    filterSuffix?: string
  }
  publicAccessBlock?: {
    blockPublicAcls?: boolean
    ignorePublicAcls?: boolean
    blockPublicPolicy?: boolean
    restrictPublicBuckets?: boolean
  }
  websiteHosting?: {
    indexDocument: string
    errorDocument?: string
  }
}
