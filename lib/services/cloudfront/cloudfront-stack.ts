import {
  Distribution,
  CachePolicy,
  AllowedMethods,
  ViewerProtocolPolicy,
  PriceClass,
  CachedMethods,
  OriginProtocolPolicy,
  OriginSslPolicy,
  CacheQueryStringBehavior,
  LambdaEdgeEventType,
} from 'aws-cdk-lib/aws-cloudfront'
import {
  HttpOrigin
} from 'aws-cdk-lib/aws-cloudfront-origins'
import {
  Stack, StackProps, Duration, Fn
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import {
  CloudFrontDistributionDefinition,
  cloudFrontDefinitions
} from './cloudfront-definitions'
import {
  Certificate, CertificateValidation 
} from 'aws-cdk-lib/aws-certificatemanager'
import {
  HostedZone, ARecord, RecordTarget 
} from 'aws-cdk-lib/aws-route53'
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets'
import {
  Runtime 
} from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import path from 'path'

interface CloudFrontStackProps extends StackProps {
  envName?: string
  imageLambdaUrl?: string
  s3WebsiteUrls?: { [key: string]: string }
}

export class CloudFrontStack extends Stack {
  public readonly distributions: { [name: string]: Distribution } = {}

  constructor(scope: Construct, id: string, props?: CloudFrontStackProps) {
    super(scope, id, props)

    const {
      envName,
      imageLambdaUrl,
      s3WebsiteUrls
    } = props || {}

    // Create basic auth Lambda@Edge function for dev environment
    let basicAuthFunction: NodejsFunction | undefined
    if (envName === 'dev') {
      const authUsername = process.env.CLOUDFRONT_AUTH_USERNAME || 'dev'
      const authPassword = process.env.CLOUDFRONT_AUTH_PASSWORD || 'dev123'

      basicAuthFunction = new NodejsFunction(this, 'BasicAuthFunction', {
        runtime: Runtime.NODEJS_20_X,
        handler: 'handler',
        entry: path.join(__dirname, '../lambda/handlers/cloudfront/basic-auth.ts'),
        functionName: `cloudfront-basic-auth-${envName}`,
        description: 'Lambda@Edge function for basic authentication on CloudFront',
        bundling: {
          minify: true,
          define: {
            'process.env.CLOUDFRONT_AUTH_USERNAME': JSON.stringify(authUsername),
            'process.env.CLOUDFRONT_AUTH_PASSWORD': JSON.stringify(authPassword)
          }
        }
      })
    }

    cloudFrontDefinitions.forEach((def: CloudFrontDistributionDefinition) => {
      // Determine the actual domain name based on environment
      let actualDomainName = def.domainName
      if (def.domainName && def.domainPrefix && envName === 'dev') {
        actualDomainName = `${def.domainPrefix}.${def.domainName}`
      }

      // Create hosted zone and certificate if domain is specified
      let certificate
      let hostedZone
      if (actualDomainName) {
        // Create a new hosted zone for the subdomain
        hostedZone = new HostedZone(this, `${def.name}-hosted-zone`, {
          zoneName: actualDomainName,
          comment: `Hosted zone for ${actualDomainName}`
        })

        // Create certificate with DNS validation
        certificate = new Certificate(this, `${def.name}-certificate`, {
          domainName: actualDomainName,
          validation: CertificateValidation.fromDns(hostedZone)
        })
      }

      // Create origins
      const origins = def.origins.map(origin => {
        let domainName = origin.domainName

        // Use provided Lambda URL for image processor
        if (origin.originId === 'image-processor-origin' && imageLambdaUrl) {
          // Extract hostname from Lambda Function URL using CDK intrinsic functions
          // Split by '//' and take the second part, then split by '/' and take the first part
          const afterProtocol = Fn.select(1, Fn.split('//', imageLambdaUrl))
          domainName = Fn.select(0, Fn.split('/', afterProtocol))
        }

        // Use provided S3 website URL for marketplace
        if (origin.originId === 'marketplace-origin' && s3WebsiteUrls?.['marketplace.csm.codes']) {
          domainName = s3WebsiteUrls['marketplace.csm.codes']
        }

        return new HttpOrigin(domainName, {
          httpsPort: origin.customOriginConfig?.httpsPort || 443,
          httpPort: origin.customOriginConfig?.httpPort || 80,
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

      // Prepare edge lambdas for basic auth in dev environment
      const edgeLambdas = []
      if (envName === 'dev' && def.requireBasicAuth && basicAuthFunction) {
        edgeLambdas.push({
          functionVersion: basicAuthFunction.currentVersion,
          eventType: LambdaEdgeEventType.VIEWER_REQUEST
        })
      }

      // Create distribution
      const distribution = new Distribution(this, def.name, {
        comment: def.comment || `${envName} ${def.name}`,
        defaultRootObject: actualDomainName ? 'index.html' : undefined,
        domainNames: actualDomainName ? [actualDomainName] : undefined,
        certificate: certificate,
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
          compress: def.defaultBehavior.compress ?? true,
          edgeLambdas: edgeLambdas.length > 0 ? edgeLambdas : undefined
        }
      })

      this.distributions[def.name] = distribution

      // Create A record if hosted zone exists
      if (hostedZone && actualDomainName) {
        new ARecord(this, `${def.name}-a-record`, {
          zone: hostedZone,
          recordName: actualDomainName,
          target: RecordTarget.fromAlias(new CloudFrontTarget(distribution))
        })
      }
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