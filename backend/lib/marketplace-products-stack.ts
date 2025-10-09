import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import * as apiGW from 'aws-cdk-lib/aws-apigateway'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { DomainLambdaConstruct } from './services/lambda/domain-lambda-construct'
import { productsEndpoints } from './services/lambda/endpoint-definitions'

export interface MarketplaceProductsStackProps extends cdk.StackProps {
  envName?: string
}

/**
 * Product management, promotions, and billing meters
 * Count: 11 Lambda functions
 *
 * Depends on: MarketplaceNetworkingStack, MarketplaceInfrastructureStack
 */
export class MarketplaceProductsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: MarketplaceProductsStackProps) {
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

    // Import Cognito User Pool and create authorizer
    const userPoolId = ssm.StringParameter.valueFromLookup(
      this,
      `/marketplace/${envName}/cognito/user-pool-id`
    )
    const userPool = cdk.aws_cognito.UserPool.fromUserPoolId(this, 'UserPool', userPoolId)
    const cognitoAuthorizer = new apiGW.CognitoUserPoolsAuthorizer(
      this,
      `CognitoAuthorizer-${envName}`,
      {
        cognitoUserPools: [userPool],
        authorizerName: `ProductsStackCognitoAuthorizer-${envName}`
      }
    )

    // Import DynamoDB tables
    const tableNames = {
      products: ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/products`),
      promos: ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/promos`),
      organizations: ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/organizations`)
    }

    const tables = {
      products: dynamodb.Table.fromTableName(this, 'ProductsTable', tableNames.products),
      promos: dynamodb.Table.fromTableName(this, 'PromosTable', tableNames.promos),
      organizations: dynamodb.Table.fromTableName(this, 'OrganizationsTable', tableNames.organizations)
    }

    const envVars = {
      'ENV_NAME': envName,
      'STRIPE_SECRET_KEY': `${envName === 'dev' ? process.env.STRIPE_SECRET_KEY_DEV : process.env.STRIPE_SECRET_KEY_PROD}`
    }

    new DomainLambdaConstruct(this, `ProductsLambdas-${envName}`, {
      envName,
      envVars,
      endpointDefinitions: productsEndpoints,
      api,
      cognitoAuthorizer,
      tables
    })

    new cdk.CfnOutput(this, 'ProductsLambdasDeployed', {
      value: productsEndpoints.length.toString(),
      description: 'Number of products Lambda functions deployed'
    })
  }
}
