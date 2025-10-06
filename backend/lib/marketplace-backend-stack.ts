import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { DdbTablesConstruct } from './services/dynamodb/ddb-tables-stack'
import { CognitoStack } from './services/cognito/cognito-stack'
import { createDefaultNodejsFunction } from './services/lambda/lambda-defaults'
import path from 'path'
import { LambdaConstruct } from './services/lambda/lambda-stack'
import { S3Construct } from './services/s3/s3-stack'
import { CloudFrontConstruct } from './services/cloudfront/cloudfront-stack'
import { Route53Construct } from './services/route53/route53-stack'

export class Marketplace extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps & { envName?: string }) {
    super(scope, id, props)
    const envName = props?.envName ?? 'dev'

    // Create all constructs (not nested stacks)
    const ddbTables = new DdbTablesConstruct(this, `DdbTables-${envName}`, { envName })

    const postAuthTriggerFunction = createDefaultNodejsFunction(this, `PostAuthTriggerFunction-${envName}`, {
      entry: path.join(__dirname, 'services', 'lambda', 'handlers', 'auth', 'post-auth-trigger.ts'),
      handler: 'postAuthTrigger',
      functionName: `post-auth-trigger-${envName}`,
      description: 'Trigger for post auth in order to create users for social sign on',
      environment: {
        USERS_TABLE_NAME: ddbTables.tables.users.tableName,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 128
    })

    // Grant permissions to the post-auth trigger function
    ddbTables.tables.users.grantReadWriteData(postAuthTriggerFunction)

    const cognitoStack = new CognitoStack(this, `Cognito-${envName}`, {
      envName, postAuthTriggerFunction
    })

    const s3Construct = new S3Construct(this, `S3-${envName}`, {
      envName
    })

    // Create Route53 hosted zones first
    const route53Construct = new Route53Construct(this, `Route53-${envName}`, {
      envName
    })

    const envVars = {
      'USER_POOL_CLIENT_ID': cognitoStack.userPoolClient.userPoolClientId,
      'USER_POOL_ID': cognitoStack.userPool.userPoolId,
      'STRIPE_SECRET_KEY': `${envName === 'dev' ? process.env.STRIPE_SECRET_KEY_DEV : process.env.STRIPE_SECRET_KEY_PROD}`,
      'STRIPE_EVENT_DESTINATION': `${envName === 'dev' ? process.env.STRIPE_EVENT_DESTINATION_DEV : process.env.STRIPE_EVENT_DESTINATION_PROD}`,
      'STRIPE_EVENT_DESTINATION_PLATFORM': `${envName === 'dev' ? process.env.STRIPE_EVENT_DESTINATION_PLATFORM_DEV : process.env.STRIPE_EVENT_DESTINATION_PLATFORM_PROD}`,
      'IMAGES_BUCKET_NAME': s3Construct.buckets['dot-images-product-store-direct'].bucketName,
      'EMAIL_AWS_REGION': process.env.EMAIL_AWS_REGION ?? '',
      'EMAIL_LAMBDA_ARN': process.env.EMAIL_LAMBDA_ARN ?? '',
      'EMAIL_ASSUME_ROLE_ARN': process.env.EMAIL_ASSUME_ROLE_ARN ?? ''
    }

    const lambdaConstruct = new LambdaConstruct(this, `Lambda-${envName}`, {
      envName,
      envVars,
      userPool: cognitoStack.userPool,
      userPoolClient: cognitoStack.userPoolClient,
      tables: ddbTables.tables,
      hostedZones: route53Construct.hostedZones
    })

    // Create CloudFront distributions
    const cloudFrontConstruct = new CloudFrontConstruct(this, `CloudFront-${envName}`, {
      envName,
      imageLambdaUrl: lambdaConstruct.imageLambdaUrl,
      s3WebsiteUrls: s3Construct.websiteUrls,
      hostedZones: route53Construct.hostedZones
    })

    // Output marketplace distribution ID and S3 bucket for frontend deployment
    const marketplaceDist = cloudFrontConstruct.distributions['marketplace-distribution']
    const marketplaceBucket = s3Construct.buckets['marketplace.csm.codes']

    if (marketplaceDist) {
      new cdk.CfnOutput(this, 'MarketplaceDistributionId', {
        value: marketplaceDist.distributionId,
        description: 'CloudFront Distribution ID for marketplace',
        exportName: `${envName}-marketplace-distribution-id`
      })
    }

    if (marketplaceBucket) {
      new cdk.CfnOutput(this, 'MarketplaceBucketName', {
        value: marketplaceBucket.bucketName,
        description: 'S3 Bucket name for marketplace static site',
        exportName: `${envName}-marketplace-bucket-name`
      })
    }

  }
}
