import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { LambdaConstruct } from './services/lambda/lambda-stack'
import { CloudFrontConstruct } from './services/cloudfront/cloudfront-stack'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as route53 from 'aws-cdk-lib/aws-route53'

export interface MarketplaceLambdaStackProps extends cdk.StackProps {
  envName?: string
}

export class MarketplaceLambdaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: MarketplaceLambdaStackProps) {
    super(scope, id, props)
    const envName = props?.envName ?? 'dev'

    // Import values from SSM Parameter Store (loose coupling)
    const userPoolId = ssm.StringParameter.valueFromLookup(
      this,
      `/marketplace/${envName}/cognito/user-pool-id`
    )
    const userPoolClientId = ssm.StringParameter.valueFromLookup(
      this,
      `/marketplace/${envName}/cognito/user-pool-client-id`
    )

    // Import DynamoDB table names and stream ARNs from SSM
    const tableNames = {
      users: ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/users`),
      organizations: ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/organizations`),
      products: ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/products`),
      promos: ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/promos`),
      purchases: ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/purchases`),
      'payment-methods': ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/payment-methods`)
    }

    const tableStreamArns = {
      users: ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/users-stream-arn`),
      organizations: ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/organizations-stream-arn`),
      products: ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/products-stream-arn`),
      promos: ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/promos-stream-arn`),
      purchases: ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/purchases-stream-arn`),
      'purchase-carts': ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/purchase-carts-stream-arn`),
      'purchased-products': ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/purchased-products-stream-arn`)
    }

    // Note: S3 bucket access is granted via IAM policies in lambda-stack.ts
    // Bucket names are constructed as ${envName}-${bucketName}

    // Import Route53 hosted zone IDs from SSM
    const hostedZoneIds = {
      'csm.codes': ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/route53/csm-codes`),
      'marketplace.csm.codes': ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/route53/marketplace-csm-codes`)
    }

    const envVars = {
      'ENV_NAME': envName,
      'USER_POOL_CLIENT_ID': userPoolClientId,
      'USER_POOL_ID': userPoolId,
      'STRIPE_SECRET_KEY': `${envName === 'dev' ? process.env.STRIPE_SECRET_KEY_DEV : process.env.STRIPE_SECRET_KEY_PROD}`,
      'STRIPE_EVENT_DESTINATION': `${envName === 'dev' ? process.env.STRIPE_EVENT_DESTINATION_DEV : process.env.STRIPE_EVENT_DESTINATION_PROD}`,
      'STRIPE_EVENT_DESTINATION_PLATFORM': `${envName === 'dev' ? process.env.STRIPE_EVENT_DESTINATION_PLATFORM_DEV : process.env.STRIPE_EVENT_DESTINATION_PLATFORM_PROD}`,
      'IMAGES_BUCKET_NAME': `${envName}-dot-images-product-store-direct`,
      'EMAIL_AWS_REGION': process.env.EMAIL_AWS_REGION ?? '',
      'EMAIL_LAMBDA_ARN': process.env.EMAIL_LAMBDA_ARN ?? '',
      'EMAIL_ASSUME_ROLE_ARN': process.env.EMAIL_ASSUME_ROLE_ARN ?? ''
    }

    // Import Cognito resources from existing infrastructure
    const userPool = cognito.UserPool.fromUserPoolId(this, 'UserPool', userPoolId)
    const userPoolClient = cognito.UserPoolClient.fromUserPoolClientId(
      this,
      'UserPoolClient',
      userPoolClientId
    )

    // Import DynamoDB tables from existing infrastructure with stream ARNs
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
      'payment-methods': dynamodb.Table.fromTableName(this, 'PaymentMethodsTable', tableNames['payment-methods']),
      'purchase-carts': dynamodb.Table.fromTableAttributes(this, 'PurchaseCartsTable', {
        tableName: ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/purchase-carts`),
        tableStreamArn: tableStreamArns['purchase-carts']
      }),
      'purchased-products': dynamodb.Table.fromTableAttributes(this, 'PurchasedProductsTable', {
        tableName: ssm.StringParameter.valueFromLookup(this, `/marketplace/${envName}/dynamodb/purchased-products`),
        tableStreamArn: tableStreamArns['purchased-products']
      })
    }

    // Import Route53 hosted zones
    const hostedZones = {
      'csm.codes': route53.HostedZone.fromHostedZoneAttributes(this, 'CsmCodesZone', {
        hostedZoneId: hostedZoneIds['csm.codes'],
        zoneName: 'csm.codes'
      }),
      'marketplace.csm.codes': route53.HostedZone.fromHostedZoneAttributes(this, 'MarketplaceCsmCodesZone', {
        hostedZoneId: hostedZoneIds['marketplace.csm.codes'],
        zoneName: 'marketplace.csm.codes'
      })
    }

    const lambdaConstruct = new LambdaConstruct(this, `Lambda-${envName}`, {
      envName,
      envVars,
      userPool,
      userPoolClient,
      tables,
      hostedZones
    })

    // Get S3 website URLs from SSM for CloudFront
    const s3WebsiteUrls = {
      'marketplace.csm.codes': ssm.StringParameter.valueFromLookup(
        this,
        `/marketplace/${envName}/s3/website-url/marketplace-csm-codes`
      )
    }

    // Create CloudFront distributions
    const cloudFrontConstruct = new CloudFrontConstruct(this, `CloudFront-${envName}`, {
      envName,
      imageLambdaUrl: lambdaConstruct.imageLambdaUrl,
      s3WebsiteUrls,
      hostedZones
    })

    // Output marketplace distribution ID for frontend deployment
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
