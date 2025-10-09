import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { DdbTablesConstruct } from './services/dynamodb/ddb-tables-stack'
import { CognitoStack } from './services/cognito/cognito-stack'
import { createDefaultNodejsFunction } from './services/lambda/lambda-defaults'
import path from 'path'
import { S3Construct } from './services/s3/s3-stack'
import { Route53Construct } from './services/route53/route53-stack'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import type { MarketplaceInfrastructureStackOutputs } from '@marketplace/types'
import { domain } from '@marketplace/constants'

export class MarketplaceInfrastructureStack extends cdk.Stack {
  public readonly outputs: MarketplaceInfrastructureStackOutputs

  constructor(scope: Construct, id: string, props?: cdk.StackProps & { envName?: string }) {
    super(scope, id, props)
    const envName = props?.envName ?? 'dev'

    // Force redeploy tag - changes when force-infra is used
    const forceRedeploy = this.node.tryGetContext('forceRedeploy')
    if (forceRedeploy) {
      cdk.Tags.of(this).add('ForceRedeploy', forceRedeploy.toString())
    }

    // Create stable infrastructure constructs
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

    const s3Construct = new S3Construct(this, `S3-${envName}`, {
      envName
    })

    // Create Route53 hosted zones
    const route53Construct = new Route53Construct(this, `Route53-${envName}`, {
      envName
    })

    // Create Cognito stack WITHOUT custom domain
    // Custom domain will be added in a separate stack after networking is deployed
    const cognitoStack = new CognitoStack(this, `Cognito-${envName}`, {
      envName,
      postAuthTriggerFunction,
      hostedZone: undefined,
      customDomainName: undefined
    })

    // Store outputs for cross-stack references
    this.outputs = {
      tables: ddbTables.tables,
      userPool: cognitoStack.userPool,
      userPoolClient: cognitoStack.userPoolClient,
      buckets: s3Construct.buckets,
      websiteUrls: s3Construct.websiteUrls,
      hostedZones: route53Construct.hostedZones
    }

    // Export important values to SSM for loose coupling
    new ssm.StringParameter(this, 'UserPoolId', {
      parameterName: `/marketplace/${envName}/cognito/user-pool-id`,
      stringValue: cognitoStack.userPool.userPoolId,
      description: `Cognito User Pool ID for ${envName}`
    })

    new ssm.StringParameter(this, 'UserPoolClientId', {
      parameterName: `/marketplace/${envName}/cognito/user-pool-client-id`,
      stringValue: cognitoStack.userPoolClient.userPoolClientId,
      description: `Cognito User Pool Client ID for ${envName}`
    })

    // Export table names and stream ARNs
    Object.entries(ddbTables.tables).forEach(([
      name,
      table
    ]) => {
      new ssm.StringParameter(this, `TableName-${name}`, {
        parameterName: `/marketplace/${envName}/dynamodb/${name}`,
        stringValue: table.tableName,
        description: `DynamoDB table name for ${name} in ${envName}`
      })

      // Export stream ARN if the table has streams enabled
      if (table.tableStreamArn) {
        new ssm.StringParameter(this, `TableStreamArn-${name}`, {
          parameterName: `/marketplace/${envName}/dynamodb/${name}-stream-arn`,
          stringValue: table.tableStreamArn,
          description: `DynamoDB stream ARN for ${name} in ${envName}`
        })
      }
    })

    // Export S3 bucket names and ARNs
    Object.entries(s3Construct.buckets).forEach(([
      name,
      bucket
    ]) => {
      new ssm.StringParameter(this, `BucketName-${name.replace(/\./g, '-')}`, {
        parameterName: `/marketplace/${envName}/s3/${name.replace(/\./g, '-')}`,
        stringValue: bucket.bucketName,
        description: `S3 bucket name for ${name} in ${envName}`
      })

      // Export bucket ARN for permission grants
      new ssm.StringParameter(this, `BucketArn-${name.replace(/\./g, '-')}`, {
        parameterName: `/marketplace/${envName}/s3/${name.replace(/\./g, '-')}-arn`,
        stringValue: bucket.bucketArn,
        description: `S3 bucket ARN for ${name} in ${envName}`
      })
    })

    // Export S3 website URLs
    Object.entries(s3Construct.websiteUrls).forEach(([
      name,
      url
    ]) => {
      new ssm.StringParameter(this, `WebsiteUrl-${name.replace(/\./g, '-')}`, {
        parameterName: `/marketplace/${envName}/s3/website-url/${name.replace(/\./g, '-')}`,
        stringValue: url,
        description: `S3 website URL for ${name} in ${envName}`
      })
    })

    // Export hosted zone IDs
    Object.entries(route53Construct.hostedZones).forEach(([
      name,
      zone
    ]) => {
      new ssm.StringParameter(this, `HostedZoneId-${name.replace(/\./g, '-')}`, {
        parameterName: `/marketplace/${envName}/route53/${name.replace(/\./g, '-')}`,
        stringValue: zone.hostedZoneId,
        description: `Route53 Hosted Zone ID for ${name} in ${envName}`
      })
    })

    // Output marketplace bucket for frontend deployment
    const marketplaceBucket = s3Construct.buckets[`${envName}-${domain}`]

    if (marketplaceBucket) {
      new cdk.CfnOutput(this, 'MarketplaceBucketName', {
        value: marketplaceBucket.bucketName,
        description: 'S3 Bucket name for marketplace static site',
        exportName: `${envName}-marketplace-bucket-name`
      })
    }

    // Output Cognito configuration for frontend
    new cdk.CfnOutput(this, 'CognitoUserPoolId', {
      value: cognitoStack.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `${envName}-cognito-user-pool-id`
    })

    new cdk.CfnOutput(this, 'CognitoClientId', {
      value: cognitoStack.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: `${envName}-cognito-client-id`
    })

    new cdk.CfnOutput(this, 'CognitoRegion', {
      value: this.region,
      description: 'AWS Region for Cognito',
      exportName: `${envName}-cognito-region`
    })
  }
}
