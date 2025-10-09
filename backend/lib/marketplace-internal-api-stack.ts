import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import * as apiGW from 'aws-cdk-lib/aws-apigateway'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { DomainLambdaConstruct } from './services/lambda/domain-lambda-construct'
import { internalApiEndpoints } from './services/lambda/endpoint-definitions'

export interface MarketplaceInternalApiStackProps extends cdk.StackProps {
  envName?: string
}

/**
 * Internal API endpoints: Protected auth, Organizations, Users, and Images
 * Count: 14 Lambda functions
 *
 * Depends on: MarketplaceNetworkingStack, MarketplaceInfrastructureStack
 */
export class MarketplaceInternalApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: MarketplaceInternalApiStackProps) {
    super(scope, id, props)
    const envName = props?.envName ?? 'dev'

    const forceRedeploy = this.node.tryGetContext('forceRedeploy')
    if (forceRedeploy) {
      cdk.Tags.of(this).add('ForceRedeploy', forceRedeploy.toString())
    }

    // Import API Gateway resources
    const restApiId = ssm.StringParameter.valueFromLookup(
      this,
      `/marketplace/${envName}/api-gateway/rest-api-id`
    )
    const rootResourceId = ssm.StringParameter.valueFromLookup(
      this,
      `/marketplace/${envName}/api-gateway/root-resource-id`
    )

    const api = apiGW.RestApi.fromRestApiAttributes(this, 'ApiGateway', {
      restApiId,
      rootResourceId
    })

    // Import Cognito info
    const userPoolId = ssm.StringParameter.valueFromLookup(
      this,
      `/marketplace/${envName}/cognito/user-pool-id`
    )
    const userPoolClientId = ssm.StringParameter.valueFromLookup(
      this,
      `/marketplace/${envName}/cognito/user-pool-client-id`
    )

    // Import Cognito User Pool and create authorizer
    const userPool = cdk.aws_cognito.UserPool.fromUserPoolId(this, 'UserPool', userPoolId)
    const cognitoAuthorizer = new apiGW.CognitoUserPoolsAuthorizer(
      this,
      `CognitoAuthorizer-${envName}`,
      {
        cognitoUserPools: [userPool],
        authorizerName: `InternalApiStackCognitoAuthorizer-${envName}`
      }
    )

    // Import DynamoDB tables
    const tableNames = {
      users: ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/users`),
      organizations: ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/organizations`),
      products: ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/products`),
      'purchased-products': ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/purchased-products`)
    }

    const tables = {
      users: dynamodb.Table.fromTableName(this, 'UsersTable', tableNames.users),
      organizations: dynamodb.Table.fromTableName(this, 'OrganizationsTable', tableNames.organizations),
      products: dynamodb.Table.fromTableName(this, 'ProductsTable', tableNames.products),
      'purchased-products': dynamodb.Table.fromTableName(this, 'PurchasedProductsTable', tableNames['purchased-products'])
    }

    const envVars = {
      'ENV_NAME': envName,
      'USER_POOL_CLIENT_ID': userPoolClientId,
      'USER_POOL_ID': userPoolId,
      'STRIPE_SECRET_KEY': `${envName === 'dev' ? process.env.STRIPE_SECRET_KEY_DEV : process.env.STRIPE_SECRET_KEY_PROD}`,
      'IMAGES_BUCKET_NAME': `${envName}-dot-images-product-store-direct`
    }

    // Create Lambda functions
    const lambdaConstruct = new DomainLambdaConstruct(this, `InternalApiLambdas-${envName}`, {
      envName,
      envVars,
      endpointDefinitions: internalApiEndpoints,
      api,
      cognitoAuthorizer,
      tables
    })

    // Export image Lambda URL to SSM for CloudFront stack
    if (lambdaConstruct.imageLambdaUrl) {
      new ssm.StringParameter(this, 'ImageLambdaUrl', {
        parameterName: `/marketplace/${envName}/lambda/image-processor-url`,
        stringValue: lambdaConstruct.imageLambdaUrl,
        description: 'Image processor Lambda Function URL for CloudFront'
      })

      new cdk.CfnOutput(this, 'ImageLambdaUrlOutput', {
        value: lambdaConstruct.imageLambdaUrl,
        description: 'Image processor Lambda Function URL',
        exportName: `${envName}-image-lambda-url`
      })
    }

    new cdk.CfnOutput(this, 'InternalApiLambdasDeployed', {
      value: internalApiEndpoints.length.toString(),
      description: 'Number of internal API Lambda functions deployed'
    })
  }
}
