import {
  domain, environment
} from '@marketplace/constants'
import { CloudFrontDistributionDefinition } from '@marketplace/types'

export const cloudFrontDefinitions: CloudFrontDistributionDefinition[] = [
  {
    name: 'image-processing-distribution',
    comment: 'CloudFront distribution for image processing Lambda',
    domainName: domain,
    subdomain: 'images',
    hostedZoneName: domain, // Share the same zone as marketplace
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
    domainName: domain,
    hostedZoneName: domain, // Share the same zone as images
    requireBasicAuth: environment === 'dev',
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
        defaultTtl: 0, // No default caching - respect S3 Cache-Control headers
        maxTtl: 31536000, // 1 year (for assets with cache headers)
        minTtl: 0
      }
    },
    priceClass: 'PriceClass_100',
    enabled: true
  },
  {
    name: 'api-gateway-distribution',
    comment: 'CloudFront distribution for API Gateway with auth cookie support',
    domainName: domain,
    subdomain: 'api',
    hostedZoneName: domain, // Share the same zone
    requireAuthCookie: true, // Enable auth cookie to header transformation
    origins: [
      {
        domainName: `api.${domain}`, // Points to API Gateway custom domain
        originId: 'api-gateway-origin',
        customOriginConfig: {
          httpsPort: 443,
          originProtocolPolicy: 'https-only',
          originSslProtocols: ['TLSv1.2']
        }
      }
    ],
    defaultBehavior: {
      targetOriginId: 'api-gateway-origin',
      viewerProtocolPolicy: 'https-only',
      allowedMethods: [
        'GET',
        'HEAD',
        'OPTIONS',
        'PUT',
        'POST',
        'PATCH',
        'DELETE'
      ],
      cachedMethods: [
        'GET',
        'HEAD'
      ],
      compress: true,
      ttl: {
        defaultTtl: 0, // No caching by default for API
        maxTtl: 0,
        minTtl: 0
      }
    },
    priceClass: 'PriceClass_100',
    enabled: true
  }
]