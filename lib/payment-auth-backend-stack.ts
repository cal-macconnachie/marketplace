import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { DdbTablesStack } from './services/dynamodb/ddb-tables-stack'
import { CognitoStack } from './services/cognito/cognito-stack'
import { createDefaultNodejsFunction } from './services/lambda/lambda-defaults'
import path from 'path'
import { LambdaStack } from './services/lambda/lambda-stack'
import { S3Stack } from './services/s3/s3-stack'
import { CloudFrontStack } from './services/cloudfront/cloudfront-stack'

export class PaymentAuthBackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps & { envName?: string }) {
    super(scope, id, props)
    const envName = props?.envName ?? 'dev'
    // The code that defines your stack goes here
    const ddbTables = new DdbTablesStack(this, `DdbTablesStack-${envName}`, { envName })
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
    const cognitoStack = new CognitoStack(this, `CognitoStack-${envName}`, {
      envName, postAuthTriggerFunction 
    })

    const s3Stack = new S3Stack(this, `S3Stack-${envName}-1`, {
      envName
    })

    const envVars = {
      'USER_POOL_CLIENT_ID': cognitoStack.userPoolClient.userPoolClientId,
      'USER_POOL_ID': cognitoStack.userPool.userPoolId,
      'STRIPE_SECRET_KEY': `${envName === 'dev' ? process.env.STRIPE_SECRET_KEY_DEV : process.env.STRIPE_SECRET_KEY_PROD}`,
      'STRIPE_EVENT_DESTINATION': `${envName === 'dev' ? process.env.STRIPE_EVENT_DESTINATION_DEV : process.env.STRIPE_EVENT_DESTINATION_PROD}`,
      'STRIPE_EVENT_DESTINATION_PLATFORM': `${envName === 'dev' ? process.env.STRIPE_EVENT_DESTINATION_PLATFORM_DEV : process.env.STRIPE_EVENT_DESTINATION_PLATFORM_PROD}`,
      'IMAGES_BUCKET_NAME': s3Stack.buckets['dot-images-product-store-direct'].bucketName,
      'EMAIL_AWS_REGION': process.env.EMAIL_AWS_REGION ?? '',
      'EMAIL_LAMBDA_ARN': process.env.EMAIL_LAMBDA_ARN ?? '',
      'EMAIL_ASSUME_ROLE_ARN': process.env.EMAIL_ASSUME_ROLE_ARN ?? ''
    }
    const lambdaStack = new LambdaStack(this, `LambdaStack-${envName}`, {
      envName,
      envVars,
      userPool: cognitoStack.userPool,
      userPoolClient: cognitoStack.userPoolClient,
      tables: ddbTables.tables,
    })

    // Create CloudFront distributions
    new CloudFrontStack(this, `CloudFrontStack-${envName}`, {
      envName,
      imageLambdaUrl: lambdaStack.imageLambdaUrl,
      s3WebsiteUrls: s3Stack.websiteUrls
    })

  }
}
