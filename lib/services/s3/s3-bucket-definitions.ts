export interface S3BucketDefinition {
  bucketName: string
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
export const s3Definitions: S3BucketDefinition[] = [
  {
    bucketName: 'dot-images-product-store',
    description: 'Image Store',
    corsRules: [
      {
        allowedMethods: [
          'PUT',
          'POST',
          'GET'
        ],
        allowedOrigins: ['*'],
        allowedHeaders: ['*']
      }
    ],
    encryption: 'NONE'
  }
]