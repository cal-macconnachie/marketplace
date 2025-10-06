/**
 * CloudFront distribution definitions and configuration types
 * Used by CDK stacks to define and create CloudFront distributions
 */

export interface CloudFrontDistributionDefinition {
  name: string
  comment?: string
  domainName?: string
  domainPrefix?: string // Prefix for dev environment (e.g., 'dev' will create dev.domain.com)
  subdomain?: string // Subdomain within the zone (e.g., 'images' for images.dev.domain.com)
  hostedZoneName?: string
  requireBasicAuth?: boolean // Enable basic auth for dev environment
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
