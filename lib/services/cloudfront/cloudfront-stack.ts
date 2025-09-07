import {
  Distribution,
  CachePolicy,
  AllowedMethods,
  ViewerProtocolPolicy,
  PriceClass,
  CachedMethods,
  OriginProtocolPolicy,
  OriginSslPolicy,
  CacheQueryStringBehavior
} from 'aws-cdk-lib/aws-cloudfront'
import {
  HttpOrigin
} from 'aws-cdk-lib/aws-cloudfront-origins'
import {
  Stack, StackProps, Duration
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import {
  CloudFrontDistributionDefinition,
  cloudFrontDefinitions
} from './cloudfront-definitions'

interface CloudFrontStackProps extends StackProps {
  envName?: string
  imageLambdaUrl?: string
}

export class CloudFrontStack extends Stack {
  public readonly distributions: { [name: string]: Distribution } = {}

  constructor(scope: Construct, id: string, props?: CloudFrontStackProps) {
    super(scope, id, props)

    const {
      envName,
      imageLambdaUrl
    } = props || {}

    cloudFrontDefinitions.forEach((def: CloudFrontDistributionDefinition) => {
      // Create origins
      const origins = def.origins.map(origin => {
        let domainName = origin.domainName
        
        // Use provided Lambda URL for image processor
        if (origin.originId === 'image-processor-origin' && imageLambdaUrl) {
          domainName = new URL(imageLambdaUrl).hostname
        }

        return new HttpOrigin(domainName, {
          httpsPort: origin.customOriginConfig?.httpsPort || 443,
          protocolPolicy: origin.customOriginConfig?.originProtocolPolicy === 'https-only' 
            ? OriginProtocolPolicy.HTTPS_ONLY 
            : origin.customOriginConfig?.originProtocolPolicy === 'http-only'
              ? OriginProtocolPolicy.HTTP_ONLY
              : OriginProtocolPolicy.MATCH_VIEWER,
          originSslProtocols: origin.customOriginConfig?.originSslProtocols?.map(protocol => 
            protocol === 'TLSv1.2' ? OriginSslPolicy.TLS_V1_2 : OriginSslPolicy.TLS_V1_2
          ) || [OriginSslPolicy.TLS_V1_2]
        })
      })

      // Create cache policy with long TTL for images
      const cachePolicy = new CachePolicy(this, `${def.name}-cache-policy`, {
        cachePolicyName: `${envName}-${def.name}-cache-policy`,
        comment: `Cache policy for ${def.name}`,
        defaultTtl: def.defaultBehavior.ttl?.defaultTtl 
          ? Duration.seconds(def.defaultBehavior.ttl.defaultTtl) 
          : Duration.days(365),
        maxTtl: def.defaultBehavior.ttl?.maxTtl 
          ? Duration.seconds(def.defaultBehavior.ttl.maxTtl) 
          : Duration.days(365),
        minTtl: def.defaultBehavior.ttl?.minTtl 
          ? Duration.seconds(def.defaultBehavior.ttl.minTtl) 
          : Duration.seconds(0),
        queryStringBehavior: CacheQueryStringBehavior.allowList('w', 'h', 'q'),
        enableAcceptEncodingGzip: true,
        enableAcceptEncodingBrotli: true
      })

      // Create distribution
      const distribution = new Distribution(this, def.name, {
        comment: def.comment || `${envName} ${def.name}`,
        defaultRootObject: undefined,
        domainNames: undefined, // Add custom domain later if needed
        enabled: def.enabled ?? true,
        priceClass: def.priceClass === 'PriceClass_100' 
          ? PriceClass.PRICE_CLASS_100 
          : def.priceClass === 'PriceClass_200'
            ? PriceClass.PRICE_CLASS_200
            : PriceClass.PRICE_CLASS_ALL,
        defaultBehavior: {
          origin: origins[0],
          allowedMethods: this.mapAllowedMethods(def.defaultBehavior.allowedMethods),
          cachedMethods: this.mapCachedMethods(def.defaultBehavior.cachedMethods),
          viewerProtocolPolicy: this.mapViewerProtocolPolicy(def.defaultBehavior.viewerProtocolPolicy),
          cachePolicy,
          compress: def.defaultBehavior.compress ?? true
        }
      })

      this.distributions[def.name] = distribution
    })
  }

  private mapAllowedMethods(methods?: string[]): AllowedMethods {
    if (!methods || methods.includes('DELETE') || methods.includes('PUT') || methods.includes('PATCH')) {
      return AllowedMethods.ALLOW_ALL
    }
    if (methods.includes('POST')) {
      return AllowedMethods.ALLOW_ALL
    }
    return AllowedMethods.ALLOW_GET_HEAD_OPTIONS
  }

  private mapCachedMethods(methods?: string[]): CachedMethods {
    if (!methods || (methods.includes('GET') && methods.includes('HEAD') && !methods.includes('OPTIONS'))) {
      return CachedMethods.CACHE_GET_HEAD
    }
    return CachedMethods.CACHE_GET_HEAD_OPTIONS
  }

  private mapViewerProtocolPolicy(policy: string): ViewerProtocolPolicy {
    switch (policy) {
      case 'https-only':
        return ViewerProtocolPolicy.HTTPS_ONLY
      case 'redirect-to-https':
        return ViewerProtocolPolicy.REDIRECT_TO_HTTPS
      case 'allow-all':
      default:
        return ViewerProtocolPolicy.ALLOW_ALL
    }
  }
}