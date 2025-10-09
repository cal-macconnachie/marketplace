import { S3BucketDefinition } from '@marketplace/types'
import { domain } from '@marketplace/constants'

export const s3Definitions: S3BucketDefinition[] = [
  {
    bucketName: 'dot-images-product-store-direct',
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
  },
  {
    bucketName: domain,
    description: 'Static website hosting for marketplace',
    websiteHosting: {
      indexDocument: 'index.html',
      errorDocument: 'error.html'
    },
    publicAccessBlock: {
      blockPublicAcls: false,
      ignorePublicAcls: false,
      blockPublicPolicy: false,
      restrictPublicBuckets: false
    },
    encryption: 'NONE'
  }
]