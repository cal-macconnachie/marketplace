import { domain } from '@marketplace/constants'
import * as cdk from 'aws-cdk-lib'
import * as apiGW from 'aws-cdk-lib/aws-apigateway'
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import { Construct } from 'constructs'
import * as path from 'node:path'
import { CloudFrontConstruct } from './services/cloudfront/cloudfront-stack'
import { createNativeBundlingConfig } from './services/lambda/bundling-configs'
import { createNodejsFunctionWithNativeDeps } from './services/lambda/lambda-defaults'

export interface MarketplaceNetworkingStackProps extends cdk.StackProps {
  envName?: string
}

/**
 * Networking stack combining API Gateway, Image Processor Lambda, and CloudFront infrastructure
 * Creates API Gateway, Usage Plan, Custom Domain, Image Processor Lambda, and CloudFront distributions
 * Exports all resources to SSM Parameter Store for consumption by domain stacks
 *
 * Note: Cognito Authorizers are created by individual domain stacks, not here
 *
 * This stack should be deployed AFTER MarketplaceInfrastructureStack
 * Dependencies:
 * - MarketplaceInfrastructureStack: Route53 Hosted Zones, S3 buckets
 */
export class MarketplaceNetworkingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: MarketplaceNetworkingStackProps) {
    super(scope, id, props)
    const envName = props?.envName ?? 'dev'

    // ========================================
    // API GATEWAY SETUP
    // ========================================

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

    // Add a root OPTIONS method to satisfy API Gateway validation
    // (API Gateway requires at least one method to be defined)
    api.root.addMethod('OPTIONS', new apiGW.MockIntegration({
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Requested-With'",
            'method.response.header.Access-Control-Allow-Origin': "'*'",
            'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,GET,POST,PUT,DELETE,PATCH'"
          }
        }
      ],
      passthroughBehavior: apiGW.PassthroughBehavior.NEVER,
      requestTemplates: {
        'application/json': '{"statusCode": 200}'
      }
    }), {
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Headers': true,
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Methods': true
          }
        }
      ]
    })

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
    // IMAGE PROCESSOR LAMBDA (for CloudFront)
    // ========================================

    const imagesBucketName = `${envName}-dot-images-product-store-direct`

    // Create image processor Lambda with native dependencies (sharp)
    const nativeBundling = createNativeBundlingConfig({})
    const imageProcessorLambda = createNodejsFunctionWithNativeDeps(
      this,
      `processImage-${envName}`,
      {
        entry: path.join(__dirname, 'services/lambda/handlers/images/image-processor.ts'),
        handler: 'processImage',
        functionName: `processImage-${envName}`,
        description: 'Process and resize images from S3',
        environment: {
          NODE_ENV: envName,
          ENV_NAME: envName,
          IMAGES_BUCKET_NAME: imagesBucketName
        },
        timeout: cdk.Duration.seconds(30),
        memorySize: 1024,
        nativeBundling
      }
    )

    // Grant S3 read access to the image processor
    imageProcessorLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [
          `arn:aws:s3:::${imagesBucketName}`,
          `arn:aws:s3:::${imagesBucketName}/*`
        ]
      })
    )

    // Create Function URL for CloudFront origin
    const imageFunctionUrl = imageProcessorLambda.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ['*'],
        allowedMethods: [lambda.HttpMethod.GET],
        allowedHeaders: ['*']
      }
    })

    const imageLambdaUrl = imageFunctionUrl.url

    // Export image Lambda URL to SSM for reference
    new ssm.StringParameter(this, 'ImageLambdaUrl', {
      parameterName: `/marketplace/${envName}/lambda/image-processor-url`,
      stringValue: imageLambdaUrl,
      description: 'Image processor Lambda Function URL for CloudFront'
    })

    // ========================================
    // CLOUDFRONT SETUP
    // ========================================

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

    // ========================================
    // COGNITO CUSTOM DOMAIN (added at end after networking is set up)
    // ========================================

    // Get UserPool ID from SSM
    const userPoolId = ssm.StringParameter.valueFromLookup(
      this,
      `/marketplace/${envName}/cognito/user-pool-id`
    )

    // Import the User Pool
    const userPool = cognito.UserPool.fromUserPoolId(
      this,
      `ImportedUserPool-${envName}`,
      userPoolId
    )

    // Determine the custom domain name for Cognito
    const cognitoCustomDomainName = envName === 'dev' ? `auth.dev.${domain}` : `auth.${domain}`

    // Create certificate for Cognito custom domain (must be in us-east-1)
    const cognitoCertificate = new certificatemanager.Certificate(
      this,
      `CognitoCertificate-${envName}`,
      {
        domainName: cognitoCustomDomainName,
        validation: certificatemanager.CertificateValidation.fromDns(hostedZone)
      }
    )

    // Create custom domain for Cognito
    const cognitoDomain = new cognito.UserPoolDomain(this, `CognitoDomain-${envName}`, {
      userPool,
      customDomain: {
        domainName: cognitoCustomDomainName,
        certificate: cognitoCertificate
      }
    })

    // Create A record for custom domain pointing to Cognito CloudFront
    new route53.ARecord(this, `CognitoARecord-${envName}`, {
      zone: hostedZone,
      recordName: cognitoCustomDomainName,
      target: route53.RecordTarget.fromAlias(new route53Targets.UserPoolDomainTarget(cognitoDomain))
    })

    // Output Cognito custom domain
    new cdk.CfnOutput(this, 'CognitoCustomDomain', {
      value: cognitoCustomDomainName,
      description: 'Cognito custom domain',
      exportName: `${envName}-cognito-custom-domain`
    })
  }
}
