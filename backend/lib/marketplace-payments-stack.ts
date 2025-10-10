import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import * as apiGW from 'aws-cdk-lib/aws-apigateway'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { DomainLambdaConstruct } from './services/lambda/domain-lambda-construct'
import { paymentsEndpoints } from './services/lambda/endpoint-definitions'

export interface MarketplacePaymentsStackProps extends cdk.StackProps {
  envName?: string
}

/**
 * Payment methods, Stripe operations, and purchase management
 * Count: 13 Lambda functions
 *
 * Depends on: MarketplaceNetworkingStack, MarketplaceInfrastructureStack
 */
export class MarketplacePaymentsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: MarketplacePaymentsStackProps) {
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
        authorizerName: `PaymentsStackCognitoAuthorizer-${envName}`
      }
    )

    // Import DynamoDB tables
    const tableNames = {
      users: ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/users`),
      organizations: ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/organizations`),
      products: ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/products`),
      purchases: ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/purchases`),
      'purchased-products': ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/purchased-products`),
      'payment-methods': ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/payment-methods`),
      'purchase-carts': ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/purchase-carts`)
    }

    const tables = {
      users: dynamodb.Table.fromTableName(this, 'UsersTable', tableNames.users),
      organizations: dynamodb.Table.fromTableName(this, 'OrganizationsTable', tableNames.organizations),
      products: dynamodb.Table.fromTableName(this, 'ProductsTable', tableNames.products),
      purchases: dynamodb.Table.fromTableName(this, 'PurchasesTable', tableNames.purchases),
      'purchased-products': dynamodb.Table.fromTableName(this, 'PurchasedProductsTable', tableNames['purchased-products']),
      'payment-methods': dynamodb.Table.fromTableName(this, 'PaymentMethodsTable', tableNames['payment-methods']),
      'purchase-carts': dynamodb.Table.fromTableName(this, 'PurchaseCartsTable', tableNames['purchase-carts'])
    }

    const envVars = {
      'ENV_NAME': envName,
      'USER_POOL_CLIENT_ID': userPoolClientId,
      'STRIPE_SECRET_KEY': `${envName === 'dev' ? process.env.STRIPE_SECRET_KEY_DEV : process.env.STRIPE_SECRET_KEY_PROD}`
    }

    new DomainLambdaConstruct(this, `PaymentsLambdas-${envName}`, {
      envName,
      envVars,
      endpointDefinitions: paymentsEndpoints,
      api,
      cognitoAuthorizer,
      tables
    })

    new cdk.CfnOutput(this, 'PaymentsLambdasDeployed', {
      value: paymentsEndpoints.length.toString(),
      description: 'Number of payments Lambda functions deployed'
    })
  }
}
