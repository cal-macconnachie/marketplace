import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { DomainLambdaConstruct } from './services/lambda/domain-lambda-construct'
import { eventsEndpoints } from './services/lambda/endpoint-definitions'

export interface MarketplaceEventsStackProps extends cdk.StackProps {
  envName?: string
}

/**
 * Event-driven Lambda functions (DynamoDB Streams and EventBridge)
 * Count: 9 Lambda functions
 *
 * Note: This stack does NOT require API Gateway - all functions are event-driven
 * Depends on: MarketplaceInfrastructureStack only
 */
export class MarketplaceEventsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: MarketplaceEventsStackProps) {
    super(scope, id, props)
    const envName = props?.envName ?? 'dev'

    const forceRedeploy = this.node.tryGetContext('forceRedeploy')
    if (forceRedeploy) {
      cdk.Tags.of(this).add('ForceRedeploy', forceRedeploy.toString())
    }

    // Import DynamoDB table names and stream ARNs from SSM
    const tableNames = {
      users: ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/users`),
      organizations: ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/organizations`),
      products: ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/products`),
      promos: ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/promos`),
      purchases: ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/purchases`),
      'purchase-carts': ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/purchase-carts`)
    }

    const tableStreamArns = {
      users: ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/users-stream-arn`),
      organizations: ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/organizations-stream-arn`),
      products: ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/products-stream-arn`),
      promos: ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/promos-stream-arn`),
      purchases: ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/purchases-stream-arn`),
      'purchase-carts': ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/purchase-carts-stream-arn`)
    }

    // Import DynamoDB tables with stream ARNs (required for stream event sources)
    const tables = {
      users: dynamodb.Table.fromTableAttributes(this, 'UsersTable', {
        tableName: tableNames.users,
        tableStreamArn: tableStreamArns.users
      }),
      organizations: dynamodb.Table.fromTableAttributes(this, 'OrganizationsTable', {
        tableName: tableNames.organizations,
        tableStreamArn: tableStreamArns.organizations
      }),
      products: dynamodb.Table.fromTableAttributes(this, 'ProductsTable', {
        tableName: tableNames.products,
        tableStreamArn: tableStreamArns.products
      }),
      promos: dynamodb.Table.fromTableAttributes(this, 'PromosTable', {
        tableName: tableNames.promos,
        tableStreamArn: tableStreamArns.promos
      }),
      purchases: dynamodb.Table.fromTableAttributes(this, 'PurchasesTable', {
        tableName: tableNames.purchases,
        tableStreamArn: tableStreamArns.purchases
      }),
      'purchase-carts': dynamodb.Table.fromTableAttributes(this, 'PurchaseCartsTable', {
        tableName: tableNames['purchase-carts'],
        tableStreamArn: tableStreamArns['purchase-carts']
      })
    }

    const envVars = {
      'ENV_NAME': envName,
      'STRIPE_SECRET_KEY': `${envName === 'dev' ? process.env.STRIPE_SECRET_KEY_DEV : process.env.STRIPE_SECRET_KEY_PROD}`,
      'STRIPE_EVENT_DESTINATION': `${envName === 'dev' ? process.env.STRIPE_EVENT_DESTINATION_DEV : process.env.STRIPE_EVENT_DESTINATION_PROD}`,
      'STRIPE_EVENT_DESTINATION_PLATFORM': `${envName === 'dev' ? process.env.STRIPE_EVENT_DESTINATION_PLATFORM_DEV : process.env.STRIPE_EVENT_DESTINATION_PLATFORM_PROD}`,
      'EMAIL_AWS_REGION': process.env.EMAIL_AWS_REGION ?? '',
      'EMAIL_LAMBDA_ARN': process.env.EMAIL_LAMBDA_ARN ?? '',
      'EMAIL_ASSUME_ROLE_ARN': process.env.EMAIL_ASSUME_ROLE_ARN ?? ''
    }

    // Create event-driven Lambda functions (no API Gateway needed)
    new DomainLambdaConstruct(this, `EventsLambdas-${envName}`, {
      envName,
      envVars,
      endpointDefinitions: eventsEndpoints,
      // Note: api and cognitoAuthorizer are NOT provided - these are event-driven only
      tables
    })

    new cdk.CfnOutput(this, 'EventsLambdasDeployed', {
      value: eventsEndpoints.length.toString(),
      description: 'Number of event-driven Lambda functions deployed'
    })
  }
}
