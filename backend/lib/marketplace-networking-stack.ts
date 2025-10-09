import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as apiGW from 'aws-cdk-lib/aws-apigateway'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager'
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets'
import { CloudFrontConstruct } from './services/cloudfront/cloudfront-stack'
import { domain } from '@marketplace/constants'

export interface MarketplaceNetworkingStackProps extends cdk.StackProps {
  envName?: string
}

/**
 * Networking stack combining API Gateway and CloudFront infrastructure
 * Creates API Gateway, Cognito Authorizer, Usage Plan, Custom Domain, and CloudFront distributions
 * Exports all resources to SSM Parameter Store for consumption by domain stacks
 *
 * This stack should be deployed AFTER MarketplaceInfrastructureStack and MarketplaceInternalApiStack
 * Dependencies:
 * - MarketplaceInfrastructureStack: Cognito User Pool, Route53 Hosted Zones, S3 buckets
 * - MarketplaceInternalApiStack: Image processor Lambda URL
 */
export class MarketplaceNetworkingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: MarketplaceNetworkingStackProps) {
    super(scope, id, props)
    const envName = props?.envName ?? 'dev'

    // ========================================
    // API GATEWAY SETUP
    // ========================================

    // Import Cognito User Pool from SSM
    const userPoolId = ssm.StringParameter.valueFromLookup(
      this,
      `/marketplace/${envName}/cognito/user-pool-id`
    )
    const userPool = cognito.UserPool.fromUserPoolId(this, 'UserPool', userPoolId)

    // Create API Gateway
    const api = new apiGW.RestApi(this, `ApiGwEndpoint-${envName}`, {
      restApiName: `${envName}-marketplace-api`,
      description: `Shared API Gateway for Marketplace in ${envName} environment`,
      deployOptions: { stageName: envName },
      binaryMediaTypes: ['text/html']
    })

    // Add CORS headers for gateway-generated errors
    const corsErrorHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': "'*'",
      'Access-Control-Allow-Headers':
        "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Requested-With'",
      'Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,PATCH,OPTIONS'"
    }

    api.addGatewayResponse('Default4XX', {
      type: apiGW.ResponseType.DEFAULT_4XX,
      responseHeaders: corsErrorHeaders
    })
    api.addGatewayResponse('Default5XX', {
      type: apiGW.ResponseType.DEFAULT_5XX,
      responseHeaders: corsErrorHeaders
    })
    api.addGatewayResponse('Unauthorized', {
      type: apiGW.ResponseType.UNAUTHORIZED,
      responseHeaders: corsErrorHeaders
    })
    api.addGatewayResponse('AccessDenied', {
      type: apiGW.ResponseType.ACCESS_DENIED,
      responseHeaders: corsErrorHeaders
    })
    api.addGatewayResponse('MissingAuthToken', {
      type: apiGW.ResponseType.MISSING_AUTHENTICATION_TOKEN,
      responseHeaders: corsErrorHeaders
    })

    // Create API Key and Usage Plan
    const apiKey = api.addApiKey('ApiKey')
    const usagePlan = api.addUsagePlan('UsagePlan', {
      name: 'DefaultUsagePlan',
      throttle: {
        rateLimit: 100,
        burstLimit: 200
      },
      quota: {
        limit: 10000,
        period: apiGW.Period.DAY
      }
    })
    usagePlan.addApiKey(apiKey)
    usagePlan.addApiStage({
      stage: api.deploymentStage
    })

    // Create Cognito Authorizer
    const cognitoAuthorizer = new apiGW.CognitoUserPoolsAuthorizer(
      this,
      `CognitoAuthorizer-${envName}`,
      {
        cognitoUserPools: [userPool],
        authorizerName: `CognitoAuthorizer-${envName}`
      }
    )

    // Setup custom domain for API Gateway
    const hostedZoneName = envName === 'dev' ? `dev.${domain}` : domain
    const apiDomain = envName === 'dev' ? `api.dev.${domain}` : `api.${domain}`

    // Import hosted zone from SSM
    const hostedZoneId = ssm.StringParameter.valueFromLookup(
      this,
      `/marketplace/${envName}/route53/${hostedZoneName.replace(/\./g, '-')}`
    )
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId,
      zoneName: hostedZoneName
    })

    // Create certificate for the API domain
    const certificate = new certificatemanager.Certificate(this, `ApiCertificate-${envName}`, {
      domainName: apiDomain,
      validation: certificatemanager.CertificateValidation.fromDns(hostedZone)
    })

    // Create custom domain for API Gateway
    const customDomain = new apiGW.DomainName(this, `ApiCustomDomain-${envName}`, {
      domainName: apiDomain,
      certificate: certificate,
      endpointType: apiGW.EndpointType.REGIONAL,
      securityPolicy: apiGW.SecurityPolicy.TLS_1_2
    })

    // Map the custom domain to the API Gateway
    customDomain.addBasePathMapping(api, {
      basePath: ''
    })

    // Create A record in Route53 pointing to the API Gateway custom domain
    new route53.ARecord(this, `ApiARecord-${envName}`, {
      zone: hostedZone,
      recordName: apiDomain,
      target: route53.RecordTarget.fromAlias(
        new route53Targets.ApiGatewayDomain(customDomain)
      )
    })

    // Export API Gateway resources to SSM for domain stacks to import
    new ssm.StringParameter(this, 'ApiGatewayRestApiId', {
      parameterName: `/marketplace/${envName}/api-gateway/rest-api-id`,
      stringValue: api.restApiId,
      description: 'API Gateway REST API ID for domain stacks'
    })

    new ssm.StringParameter(this, 'ApiGatewayRootResourceId', {
      parameterName: `/marketplace/${envName}/api-gateway/root-resource-id`,
      stringValue: api.root.resourceId,
      description: 'API Gateway root resource ID for domain stacks'
    })

    new ssm.StringParameter(this, 'CognitoAuthorizerId', {
      parameterName: `/marketplace/${envName}/api-gateway/cognito-authorizer-id`,
      stringValue: cognitoAuthorizer.authorizerId,
      description: 'Cognito authorizer ID for domain stacks'
    })

    new ssm.StringParameter(this, 'ApiKeyId', {
      parameterName: `/marketplace/${envName}/api-gateway/api-key-id`,
      stringValue: apiKey.keyId,
      description: 'API Key ID for domain stacks'
    })

    // Export the deployment stage name (needed for usage plan association)
    new ssm.StringParameter(this, 'ApiGatewayStageName', {
      parameterName: `/marketplace/${envName}/api-gateway/stage-name`,
      stringValue: api.deploymentStage.stageName,
      description: 'API Gateway deployment stage name'
    })

    // ========================================
    // CLOUDFRONT SETUP
    // ========================================

    // Import image Lambda URL from SSM (created by InternalApiStack)
    const imageLambdaUrl = ssm.StringParameter.valueFromLookup(
      this,
      `/marketplace/${envName}/lambda/image-processor-url`
    )

    // Get S3 website URLs from SSM for CloudFront
    const marketplaceBucketName = `${envName}-${domain}`
    const s3WebsiteUrls = {
      [domain]: ssm.StringParameter.valueFromLookup(
        this,
        `/marketplace/${envName}/s3/website-url/${marketplaceBucketName.replace(/\./g, '-')}`
      )
    }

    // Reuse the same hosted zone for CloudFront
    const hostedZones = {
      [hostedZoneName]: hostedZone
    }

    // Create CloudFront distributions
    const cloudFrontConstruct = new CloudFrontConstruct(this, `CloudFront-${envName}`, {
      envName,
      imageLambdaUrl,
      s3WebsiteUrls,
      hostedZones
    })

    // ========================================
    // CLOUDFORMATION OUTPUTS
    // ========================================

    // API Gateway outputs
    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: api.url,
      description: 'API Gateway URL',
      exportName: `${envName}-api-gateway-url`
    })

    new cdk.CfnOutput(this, 'ApiCustomDomainUrl', {
      value: `https://${apiDomain}`,
      description: 'API Gateway custom domain URL',
      exportName: `${envName}-api-domain-url`
    })

    new cdk.CfnOutput(this, 'ApiGatewayRestApiIdOutput', {
      value: api.restApiId,
      description: 'API Gateway REST API ID',
      exportName: `${envName}-api-rest-api-id`
    })

    // CloudFront outputs
    const marketplaceDist = cloudFrontConstruct.distributions['marketplace-distribution']
    if (marketplaceDist) {
      new cdk.CfnOutput(this, 'MarketplaceDistributionId', {
        value: marketplaceDist.distributionId,
        description: 'CloudFront Distribution ID for marketplace',
        exportName: `${envName}-marketplace-distribution-id`
      })
    }
  }
}
