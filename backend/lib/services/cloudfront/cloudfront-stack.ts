import { CloudFrontDistributionDefinition } from '@marketplace/types'
import {
  Duration, Fn
} from 'aws-cdk-lib'
import {
  Certificate, CertificateValidation
} from 'aws-cdk-lib/aws-certificatemanager'
import {
  AllowedMethods,
  CachedMethods,
  CachePolicy,
  CacheQueryStringBehavior,
  Function as CloudFrontFunction,
  Distribution,
  FunctionCode,
  FunctionEventType,
  OriginProtocolPolicy,
  OriginSslPolicy,
  PriceClass,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront'
import {
  HttpOrigin
} from 'aws-cdk-lib/aws-cloudfront-origins'
import {
  ARecord,
  HostedZone,
  IHostedZone,
  RecordTarget
} from 'aws-cdk-lib/aws-route53'
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets'
import { Construct } from 'constructs'
import * as fs from 'fs'
import path from 'path'
import { cloudFrontDefinitions } from './cloudfront-definitions'
import { transformSync } from 'esbuild'

interface CloudFrontConstructProps {
  envName?: string
  imageLambdaUrl?: string
  s3WebsiteUrls?: { [key: string]: string }
  hostedZones?: { [zoneName: string]: IHostedZone }
}

export class CloudFrontConstruct extends Construct {
  public readonly distributions: { [name: string]: Distribution } = {}
  private readonly createdHostedZones: { [zoneName: string]: IHostedZone } = {}

  constructor(scope: Construct, id: string, props?: CloudFrontConstructProps) {
    super(scope, id)

    const {
      envName,
      imageLambdaUrl,
      s3WebsiteUrls,
      hostedZones
    } = props || {}

    // Create basic auth CloudFront Function for dev environment
    let basicAuthFunction: CloudFrontFunction | undefined
    if (envName === 'dev') {
      const authUsername = process.env.CLOUDFRONT_AUTH_USERNAME || 'dev'
      const authPassword = process.env.CLOUDFRONT_AUTH_PASSWORD || 'dev123'

      // Read and compile the CloudFront Function TypeScript code
      const functionCodePath = path.join(__dirname, 'basic-auth-function.ts')
      const tsCode = fs.readFileSync(functionCodePath, 'utf-8')

      // Compile TypeScript to ES5 JavaScript for CloudFront Functions
      const compiled = transformSync(tsCode, {
        loader: 'ts',
        target: 'es5',
        format: 'esm',
        minify: true
      })

      // Replace placeholders with actual credentials
      let functionCode = compiled.code
      functionCode = functionCode.replace('CLOUDFRONT_AUTH_USERNAME_PLACEHOLDER', authUsername)
      functionCode = functionCode.replace('CLOUDFRONT_AUTH_PASSWORD_PLACEHOLDER', authPassword)

      basicAuthFunction = new CloudFrontFunction(this, 'BasicAuthCloudfrontFunction', {
        code: FunctionCode.fromInline(functionCode),
        functionName: `basic-auth-${envName}`,
        comment: 'CloudFront Function for basic authentication'
      })
    }

    cloudFrontDefinitions.forEach((def: CloudFrontDistributionDefinition) => {
      // Determine the actual domain name based on environment and subdomain
      let actualDomainName: string | undefined = def.domainName
      if (def.domainName) {
        // Build the full domain name: [subdomain.]<envPrefix.>domain.com
        const parts: string[] = []

        if (def.subdomain) {
          parts.push(def.subdomain)
        }

        if (def.domainPrefix && envName === 'dev') {
          parts.push(def.domainPrefix)
        }

        parts.push(def.domainName)
        actualDomainName = parts.join('.')
      }

      // Determine the hosted zone name (or use actualDomainName if not specified)
      const hostedZoneName = def.hostedZoneName || def.domainName

      // Create or reuse hosted zone and certificate if domain is specified
      let certificate
      let hostedZone
      if (actualDomainName && hostedZoneName) {
        // Determine the actual hosted zone name based on environment
        let actualHostedZoneName = hostedZoneName
        if (envName === 'dev' && def.domainPrefix) {
          // For dev, use the dev-prefixed zone name (e.g., dev.marketplace.csm.codes)
          actualHostedZoneName = `${def.domainPrefix}.${hostedZoneName}`
        }

        // Use provided hosted zone, or reuse already created zone, or create a new one
        if (hostedZones && hostedZones[actualHostedZoneName]) {
          hostedZone = hostedZones[actualHostedZoneName]
        } else if (this.createdHostedZones[actualHostedZoneName]) {
          hostedZone = this.createdHostedZones[actualHostedZoneName]
        } else {
          hostedZone = new HostedZone(this, `hosted-zone-${actualHostedZoneName.replace(/\./g, '-')}`, {
            zoneName: actualHostedZoneName,
            comment: `Hosted zone for ${actualHostedZoneName}`
          })
          this.createdHostedZones[actualHostedZoneName] = hostedZone
        }

        // Create certificate for this specific domain (not shared)
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

      // Prepare CloudFront Functions for basic auth in dev environment
      const functionAssociations = []
      if (envName === 'dev' && def.requireBasicAuth && basicAuthFunction) {
        functionAssociations.push({
          function: basicAuthFunction,
          eventType: FunctionEventType.VIEWER_REQUEST
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
          functionAssociations: functionAssociations.length > 0 ? functionAssociations : undefined
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