export interface CloudFrontDistributionDefinition {
  name: string
  comment?: string
  domainName?: string
  hostedZoneName?: string
  origins: {
    domainName: string
    originId: string
    customOriginConfig?: {
      httpPort?: number
      httpsPort?: number
      originProtocolPolicy: 'http-only' | 'match-viewer' | 'https-only'
      originSslProtocols?: string[]
    }
    s3OriginConfig?: {
      originAccessIdentity?: string
    }
  }[]
  defaultBehavior: {
    targetOriginId: string
    viewerProtocolPolicy: 'allow-all' | 'redirect-to-https' | 'https-only'
    allowedMethods?: string[]
    cachedMethods?: string[]
    cachePolicyId?: string
    compress?: boolean
    ttl?: {
      defaultTtl?: number
      maxTtl?: number
      minTtl?: number
    }
  }
  additionalBehaviors?: {
    pathPattern: string
    targetOriginId: string
    viewerProtocolPolicy: 'allow-all' | 'redirect-to-https' | 'https-only'
    allowedMethods?: string[]
    cachedMethods?: string[]
    cachePolicyId?: string
    compress?: boolean
    ttl?: {
      defaultTtl?: number
      maxTtl?: number
      minTtl?: number
    }
  }[]
  priceClass?: 'PriceClass_All' | 'PriceClass_100' | 'PriceClass_200'
  enabled?: boolean
}

export const cloudFrontDefinitions: CloudFrontDistributionDefinition[] = [
  {
    name: 'image-processing-distribution',
    comment: 'CloudFront distribution for image processing Lambda',
    origins: [
      {
        domainName: '', // Will be set dynamically from Lambda function URL
        originId: 'image-processor-origin',
        customOriginConfig: {
          httpsPort: 443,
          originProtocolPolicy: 'https-only',
          originSslProtocols: ['TLSv1.2']
        }
      }
    ],
    defaultBehavior: {
      targetOriginId: 'image-processor-origin',
      viewerProtocolPolicy: 'redirect-to-https',
      allowedMethods: [
        'GET',
        'HEAD',
        'OPTIONS'
      ],
      cachedMethods: [
        'GET',
        'HEAD'
      ],
      compress: true,
      ttl: {
        defaultTtl: 31536000, // 1 year
        maxTtl: 31536000,
        minTtl: 0
      }
    },
    priceClass: 'PriceClass_100',
    enabled: true
  },
  {
    name: 'marketplace-distribution',
    comment: 'CloudFront distribution for marketplace static website',
    domainName: 'marketplace.csm.codes',
    origins: [
      {
        domainName: '', // Will be set dynamically from S3 bucket website endpoint
        originId: 'marketplace-origin',
        customOriginConfig: {
          httpPort: 80,
          httpsPort: 443,
          originProtocolPolicy: 'http-only',
          originSslProtocols: ['TLSv1.2']
        }
      }
    ],
    defaultBehavior: {
      targetOriginId: 'marketplace-origin',
      viewerProtocolPolicy: 'redirect-to-https',
      allowedMethods: [
        'GET',
        'HEAD',
        'OPTIONS'
      ],
      cachedMethods: [
        'GET',
        'HEAD'
      ],
      compress: true,
      ttl: {
        defaultTtl: 86400, // 1 day
        maxTtl: 31536000, // 1 year
        minTtl: 0
      }
    },
    priceClass: 'PriceClass_100',
    enabled: true
  }
]