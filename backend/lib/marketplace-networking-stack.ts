import { domain } from '@marketplace/constants'
import * as cdk from 'aws-cdk-lib'
import * as apiGW from 'aws-cdk-lib/aws-apigateway'
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager'
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

    // Export API Gateway regional endpoint for CloudFront origin
    // CloudFront will handle the custom domain (api.dev.marketplace.csm.codes)
    const apiGatewayUrl = `${api.restApiId}.execute-api.${this.region}.amazonaws.com`

    new ssm.StringParameter(this, 'ApiGatewayEndpointUrl', {
      parameterName: `/marketplace/${envName}/api-gateway/endpoint-url`,
      stringValue: apiGatewayUrl,
      description: 'API Gateway regional endpoint URL (without protocol) for CloudFront origin'
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
        resources: [`arn:aws:s3:::${imagesBucketName}/*`]
      })
    )

    // ListBucket permission is required on the bucket itself (not objects)
    // for S3 to properly handle access denied vs not found scenarios
    imageProcessorLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['s3:ListBucket'],
        resources: [`arn:aws:s3:::${imagesBucketName}`]
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
    const marketplaceBucketName = domain
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
      hostedZones,
      apiGatewayUrl
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

    new cdk.CfnOutput(this, 'ApiGatewayRegionalEndpoint', {
      value: apiGatewayUrl,
      description: 'API Gateway regional endpoint (used by CloudFront)',
      exportName: `${envName}-api-regional-endpoint`
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

    // Cognito custom domain moved to dedicated stack (MarketplaceCognitoDomain)
  }
}
