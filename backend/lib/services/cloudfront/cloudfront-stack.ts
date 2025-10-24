import { domain } from '@marketplace/constants'
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
  ErrorResponse,
  FunctionCode,
  FunctionEventType,
  FunctionRuntime,
  KeyValueStore,
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
import { cloudFrontDefinitions } from './cloudfront-definitions'

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

    // Create basic auth CloudFront Function and KeyValueStore for dev environment
    let basicAuthFunction: CloudFrontFunction | undefined
    let authKeyValueStore: KeyValueStore | undefined
    if (envName === 'dev') {
      const authUsername = process.env.CLOUDFRONT_AUTH_USERNAME
      const authPassword = process.env.CLOUDFRONT_AUTH_PASSWORD

      // Pre-compute the expected super admin auth header
      let superAdminAuth: string | undefined
      if (authUsername && authPassword) {
        superAdminAuth = 'Basic ' + Buffer.from(`${authUsername}:${authPassword}`).toString('base64')
      }

      // Create KeyValueStore for additional dev users
      authKeyValueStore = new KeyValueStore(this, 'DevAuthKeyValueStore', {
        keyValueStoreName: `dev-auth-kvs-${envName}`,
        comment: 'Key-Value Store for dev user credentials'
      })

      // Get the KVS ID to inject into the function code

      // Inline CloudFront Function code (ES2020+ with CloudFront runtime 2.0)
      // Checks super admin credentials first, then falls back to KeyValueStore
      const functionCode = `
import cf from 'cloudfront';

const kvsHandle = cf.kvs();
${superAdminAuth != null ? `const superAdminAuth = '${superAdminAuth}';` : ''}

async function handler(event) {
  const request = event.request;
  const headers = request.headers;

  const authHeader = headers.authorization ? headers.authorization.value : null;
  ${superAdminAuth != null ? `
  // Check super admin credentials first
  if (authHeader === superAdminAuth) {
    return request;
  }
  ` : ''}

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return unauthorized('no-auth');
  }

  try {
    const credentials = authHeader.substring(6);
    const decoded = atob(credentials);
    const colonIndex = decoded.indexOf(':');

    if (colonIndex === -1) {
      return unauthorized('no-colon');
    }

    const username = decoded.split(':')[0];
    const password = decoded.split(':')[1];

    // Check KeyValueStore for this username
    const storedPassword = await kvsHandle.get(username);

    if (!storedPassword) {
      return unauthorized('user-not-in-kvs:' + username);
    }

    if (storedPassword !== password) {
      return unauthorized('password-mismatch');
    }

    return request;
  } catch (e) {
    return unauthorized('kvs-error: ' + e.message);
  }

  return unauthorized('fallthrough');
}

function unauthorized(reason) {
  return {
    statusCode: 401,
    statusDescription: 'Unauthorized',
    headers: {
      'www-authenticate': { value: 'Basic realm="Protected Site"' },
      'content-type': { value: 'text/html' },
      'x-auth-reason': { value: reason || 'Unknown' }
    },
    body: '<h1>401 Unauthorized</h1><p>Authentication required.</p>'
  };
}
      `.trim()

      basicAuthFunction = new CloudFrontFunction(this, 'BasicAuthCloudfrontFunction', {
        code: FunctionCode.fromInline(functionCode),
        functionName: `basic-auth-${envName}`,
        comment: 'CloudFront Function for basic authentication with KVS support',
        runtime: FunctionRuntime.JS_2_0,
        keyValueStore: authKeyValueStore
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
        if (origin.originId === 'marketplace-origin' && s3WebsiteUrls?.[domain]) {
          domainName = s3WebsiteUrls[domain]
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

      // Create cache policy - with query string caching only for images
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
        // Only cache query strings for image processing (w, h, q params)
        queryStringBehavior: def.name === 'image-processing-distribution'
          ? CacheQueryStringBehavior.allowList('w', 'h', 'q')
          : CacheQueryStringBehavior.none(),
        enableAcceptEncodingGzip: true,
        enableAcceptEncodingBrotli: true
      })

      // Prepare CloudFront Functions for basic auth in dev environment
      const functionAssociations = []
      if (def.requireBasicAuth && basicAuthFunction) {
        functionAssociations.push({
          function: basicAuthFunction,
          eventType: FunctionEventType.VIEWER_REQUEST
        })
      }

      // Create custom error responses for SPA routing (marketplace distribution only)
      const errorResponses: ErrorResponse[] | undefined = def.name === 'marketplace-distribution'
        ? [
          {
            httpStatus: 403,
            responseHttpStatus: 200,
            responsePagePath: '/index.html',
            ttl: Duration.seconds(0) // Don't cache error responses
          },
          {
            httpStatus: 404,
            responseHttpStatus: 200,
            responsePagePath: '/index.html',
            ttl: Duration.seconds(0) // Don't cache error responses
          }
        ]
        : undefined

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
        errorResponses,
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