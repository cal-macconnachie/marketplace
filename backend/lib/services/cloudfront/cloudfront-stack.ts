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
  ICachePolicy,
  IOriginRequestPolicy,
  KeyValueStore,
  OriginProtocolPolicy,
  OriginRequestCookieBehavior,
  OriginRequestHeaderBehavior,
  OriginRequestPolicy,
  OriginRequestQueryStringBehavior,
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
  apiGatewayUrl?: string
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
      hostedZones,
      apiGatewayUrl
    } = props || {}

    // Create auth cookie to header function for API Gateway
    const authCookieToHeaderFunction = new CloudFrontFunction(this, 'AuthCookieToHeaderFunction', {
      code: FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var cookies = request.cookies;

  // Extract authToken from httpOnly cookies
  // Priority: authToken (idToken) > accessToken
  var token = null;
  if (cookies.authToken) {
    token = cookies.authToken.value;
  } else if (cookies.accessToken) {
    token = cookies.accessToken.value;
  }

  // If token found, add it to Authorization header for Cognito authorizer
  if (token) {
    request.headers.authorization = {
      value: 'Bearer ' + token
    };
  }

  return request;
}
      `.trim()),
      functionName: `auth-cookie-to-header-${envName}`,
      comment: 'Extracts auth token from httpOnly cookies and adds to Authorization header',
      runtime: FunctionRuntime.JS_2_0
    })

    // Create response headers function for Apple verification file
    const responseHeadersFunction = new CloudFrontFunction(this, 'ResponseHeadersFunction', {
      code: FunctionCode.fromInline(`
function handler(event) {
  var response = event.response;
  var request = event.request;
  var uri = request.uri;

  // Set Content-Type for Apple verification file without extension
  if (uri === '/.well-known/apple-developer-merchantid-domain-association') {
    response.headers['content-type'] = { value: 'text/plain' };
  }

  return response;
}
      `.trim()),
      functionName: `response-headers-${envName}`,
      comment: 'Sets correct Content-Type for Apple domain verification',
      runtime: FunctionRuntime.JS_2_0
    })

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

    // Extract root domain from the domain constant (e.g., "dev.marketplace.csm.codes" -> "csm.codes")
    const rootDomain = domain.split('.').slice(-2).join('.')

    // Create CloudFront Function for dynamic CORS based on origin
    // This allows any subdomain of the root domain to make authenticated requests
    const dynamicCorsFunction = new CloudFrontFunction(this, 'DynamicCorsFunction', {
      code: FunctionCode.fromInline(`
function handler(event) {
  var response = event.response;
  var request = event.request;
  var headers = response.headers;

  // Get the origin from the request
  var origin = request.headers.origin ? request.headers.origin.value : null;

  if (origin) {
    // Extract the domain from the origin (remove protocol)
    var originDomain = origin.replace(/^https?:\\/\\//, '');

    // Check if origin is root domain or subdomain of root domain
    var rootDomain = '${rootDomain}';
    var isRootDomain = originDomain === rootDomain;
    var isSubdomain = originDomain.endsWith('.' + rootDomain);
    var isLocalhost = originDomain.startsWith('localhost:') || originDomain === 'localhost';

    if (isRootDomain || isSubdomain || isLocalhost) {
      // Allow this origin with credentials
      // NOTE: Cannot use wildcards (*) when credentials are enabled - must list specific headers
      headers['access-control-allow-origin'] = { value: origin };
      headers['access-control-allow-credentials'] = { value: 'true' };
      headers['access-control-allow-methods'] = { value: 'GET,HEAD,OPTIONS,PUT,POST,PATCH,DELETE' };
      headers['access-control-allow-headers'] = { value: 'Content-Type,Authorization,X-Requested-With,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,Accept,Accept-Language,Origin,Referer' };
      headers['access-control-max-age'] = { value: '600' };
    }
  }

  // Add security headers
  headers['x-frame-options'] = { value: 'SAMEORIGIN' };
  headers['x-content-type-options'] = { value: 'nosniff' };

  return response;
}
      `.trim()),
      functionName: `dynamic-cors-${envName}`,
      comment: 'Dynamic CORS for all subdomains of root domain and localhost with credentials support',
      runtime: FunctionRuntime.JS_2_0
    })

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

        // Use provided API Gateway URL for api-gateway-origin
        if (origin.originId === 'api-gateway-origin' && apiGatewayUrl) {
          domainName = apiGatewayUrl
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
          ) || [OriginSslPolicy.TLS_V1_2],
          originPath: origin.customOriginConfig?.originPath
        })
      })

      // For API Gateway with no caching, use managed CACHING_DISABLED policy
      // For others, create custom cache policy
      let cachePolicy: ICachePolicy
      let originRequestPolicy: IOriginRequestPolicy | undefined

      if (def.name === 'api-gateway-distribution') {
        // Use managed policy for no caching
        cachePolicy = CachePolicy.CACHING_DISABLED

        // Create origin request policy to control what gets forwarded to API Gateway
        // IMPORTANT: Do NOT forward Host header - API Gateway needs its own domain as Host
        // Authorization is handled via CloudFront Function (auth cookie to header)
        originRequestPolicy = new OriginRequestPolicy(this, `${def.name}-origin-request-policy`, {
          originRequestPolicyName: `${envName}-${def.name}-origin-policy`,
          comment: `Origin request policy for ${def.name} - forwards specific headers (NOT Host), all cookies and query strings`,
          cookieBehavior: OriginRequestCookieBehavior.all(),
          headerBehavior: OriginRequestHeaderBehavior.allowList(
            'Accept',
            'Accept-Language',
            'CloudFront-Viewer-Country',
            'Origin',
            'Referer',
            'User-Agent',
            'Access-Control-Request-Headers',
            'Access-Control-Request-Method',
            'Content-Type',
            'X-Requested-With'
          ),
          queryStringBehavior: OriginRequestQueryStringBehavior.all()
        })
      } else {
        // Custom cache policy for image processing and marketplace
        cachePolicy = new CachePolicy(this, `${def.name}-cache-policy`, {
          cachePolicyName: `${envName}-${def.name}-cache-policy`,
          comment: `Cache policy for ${def.name}`,
          defaultTtl: def.defaultBehavior.ttl?.defaultTtl !== undefined
            ? Duration.seconds(def.defaultBehavior.ttl.defaultTtl)
            : Duration.days(365),
          maxTtl: def.defaultBehavior.ttl?.maxTtl !== undefined
            ? Duration.seconds(def.defaultBehavior.ttl.maxTtl)
            : Duration.days(365),
          minTtl: def.defaultBehavior.ttl?.minTtl !== undefined
            ? Duration.seconds(def.defaultBehavior.ttl.minTtl)
            : Duration.seconds(0),
          // Query string behavior for caching:
          // - Image processing: cache by w, h, q params
          // - Others: none
          queryStringBehavior: def.name === 'image-processing-distribution'
            ? CacheQueryStringBehavior.allowList('w', 'h', 'q')
            : CacheQueryStringBehavior.none(),
          enableAcceptEncodingGzip: true,
          enableAcceptEncodingBrotli: true
        })
      }

      // Prepare CloudFront Functions
      const functionAssociations = []

      // Add auth cookie to header function for API Gateway
      if (def.requireAuthCookie) {
        functionAssociations.push({
          function: authCookieToHeaderFunction,
          eventType: FunctionEventType.VIEWER_REQUEST
        })
      }

      // Add basic auth in dev environment (runs before auth cookie function if both present)
      if (def.requireBasicAuth && basicAuthFunction) {
        functionAssociations.push({
          function: basicAuthFunction,
          eventType: FunctionEventType.VIEWER_REQUEST
        })
      }

      // Add dynamic CORS function for API Gateway (viewer response)
      if (def.name === 'api-gateway-distribution') {
        functionAssociations.push({
          function: dynamicCorsFunction,
          eventType: FunctionEventType.VIEWER_RESPONSE
        })
      }

      // Add response headers function for marketplace distribution (Apple verification)
      if (def.name === 'marketplace-distribution') {
        functionAssociations.push({
          function: responseHeadersFunction,
          eventType: FunctionEventType.VIEWER_RESPONSE
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
          originRequestPolicy, // Only set for API Gateway distribution
          // CORS is now handled by dynamic CORS function for API Gateway
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