import * as cdk from 'aws-cdk-lib'
import * as apiGW from 'aws-cdk-lib/aws-apigateway'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import { Construct } from 'constructs'
import { DomainLambdaConstruct } from './services/lambda/domain-lambda-construct'
import { publicEndpoints } from './services/lambda/endpoint-definitions'

export interface MarketplacePublicStackProps extends cdk.StackProps {
  envName?: string
}

/**
 * Public API Lambda functions (no authentication required)
 * Includes: Auth endpoints, public product/org reads, guest checkout
 * Count: 11 Lambda functions
 *
 * Depends on: MarketplaceNetworkingStack, MarketplaceInfrastructureStack
 */
export class MarketplacePublicStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: MarketplacePublicStackProps) {
    super(scope, id, props)
    const envName = props?.envName ?? 'dev'

    // Force redeploy tag
    const forceRedeploy = this.node.tryGetContext('forceRedeploy')
    if (forceRedeploy) {
      cdk.Tags.of(this).add('ForceRedeploy', forceRedeploy.toString())
    }

    // Import API Gateway resources from SSM (exported by MarketplaceNetworkingStack)
    const restApiId = ssm.StringParameter.valueFromLookup(
      this,
      `/marketplace/${envName}/api-gateway/rest-api-id`
    )
    const rootResourceId = ssm.StringParameter.valueFromLookup(
      this,
      `/marketplace/${envName}/api-gateway/root-resource-id`
    )

    // Import API Gateway
    const api = apiGW.RestApi.fromRestApiAttributes(this, 'ApiGateway', {
      restApiId,
      rootResourceId
    })

    // Import Cognito User Pool info from SSM (no authorizer needed for public stack)
    const userPoolId = ssm.StringParameter.valueFromLookup(
      this,
      `/marketplace/${envName}/cognito/user-pool-id`
    )
    const userPoolClientId = ssm.StringParameter.valueFromLookup(
      this,
      `/marketplace/${envName}/cognito/user-pool-client-id`
    )

    // Environment variables for Lambda functions
    const envVars = {
      'ENV_NAME': envName,
      'USER_POOL_CLIENT_ID': userPoolClientId,
      'USER_POOL_ID': userPoolId,
      'STRIPE_SECRET_KEY': `${envName === 'dev' ? process.env.STRIPE_SECRET_KEY_DEV : process.env.STRIPE_SECRET_KEY_PROD}`,
      'EMAIL_AWS_REGION': process.env.EMAIL_AWS_REGION ?? '',
      'EMAIL_LAMBDA_ARN': process.env.EMAIL_LAMBDA_ARN ?? '',
      'EMAIL_ASSUME_ROLE_ARN': process.env.EMAIL_ASSUME_ROLE_ARN ?? ''
    }

    // Create Lambda functions for public endpoints
    new DomainLambdaConstruct(this, `PublicLambdas-${envName}`, {
      envName,
      envVars,
      endpointDefinitions: publicEndpoints,
      api
      // No Cognito authorizer passed; all public endpoints are unauthenticated
    })

    // Output
    new cdk.CfnOutput(this, 'PublicLambdasDeployed', {
      value: publicEndpoints.length.toString(),
      description: 'Number of public Lambda functions deployed'
    })
  }
}
