import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { LambdaConstruct } from './services/lambda/lambda-stack'
import { CloudFrontConstruct } from './services/cloudfront/cloudfront-stack'
import type { MarketplaceInfrastructureStackOutputs } from './marketplace-infrastructure-stack'

export interface MarketplaceLambdaStackProps extends cdk.StackProps {
  envName?: string
  infrastructureOutputs: MarketplaceInfrastructureStackOutputs
}

export class MarketplaceLambdaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MarketplaceLambdaStackProps) {
    super(scope, id, props)
    const envName = props?.envName ?? 'dev'
    const { infrastructureOutputs } = props

    const envVars = {
      'USER_POOL_CLIENT_ID': infrastructureOutputs.userPoolClient.userPoolClientId,
      'USER_POOL_ID': infrastructureOutputs.userPool.userPoolId,
      'STRIPE_SECRET_KEY': `${envName === 'dev' ? process.env.STRIPE_SECRET_KEY_DEV : process.env.STRIPE_SECRET_KEY_PROD}`,
      'STRIPE_EVENT_DESTINATION': `${envName === 'dev' ? process.env.STRIPE_EVENT_DESTINATION_DEV : process.env.STRIPE_EVENT_DESTINATION_PROD}`,
      'STRIPE_EVENT_DESTINATION_PLATFORM': `${envName === 'dev' ? process.env.STRIPE_EVENT_DESTINATION_PLATFORM_DEV : process.env.STRIPE_EVENT_DESTINATION_PLATFORM_PROD}`,
      'IMAGES_BUCKET_NAME': infrastructureOutputs.buckets['dot-images-product-store-direct'].bucketName,
      'EMAIL_AWS_REGION': process.env.EMAIL_AWS_REGION ?? '',
      'EMAIL_LAMBDA_ARN': process.env.EMAIL_LAMBDA_ARN ?? '',
      'EMAIL_ASSUME_ROLE_ARN': process.env.EMAIL_ASSUME_ROLE_ARN ?? ''
    }

    const lambdaConstruct = new LambdaConstruct(this, `Lambda-${envName}`, {
      envName,
      envVars,
      userPool: infrastructureOutputs.userPool,
      userPoolClient: infrastructureOutputs.userPoolClient,
      tables: infrastructureOutputs.tables,
      hostedZones: infrastructureOutputs.hostedZones
    })

    // Create CloudFront distributions
    const cloudFrontConstruct = new CloudFrontConstruct(this, `CloudFront-${envName}`, {
      envName,
      imageLambdaUrl: lambdaConstruct.imageLambdaUrl,
      s3WebsiteUrls: infrastructureOutputs.websiteUrls,
      hostedZones: infrastructureOutputs.hostedZones
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
