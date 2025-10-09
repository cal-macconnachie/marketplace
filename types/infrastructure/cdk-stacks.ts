/**
 * CDK Stack output types and interfaces
 * Used for cross-stack references and outputs
 * @internal Backend only
 */

import type * as cdk from 'aws-cdk-lib'
import type * as cognito from 'aws-cdk-lib/aws-cognito'
import type * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import type * as route53 from 'aws-cdk-lib/aws-route53'
import type * as s3 from 'aws-cdk-lib/aws-s3'

/**
 * Outputs from the MarketplaceInfrastructureStack
 * Kept for backward compatibility
 */
export interface MarketplaceInfrastructureStackOutputs {
  tables: Record<string, dynamodb.Table>
  userPool: cognito.UserPool
  userPoolClient: cognito.UserPoolClient
  buckets: { [bucketName: string]: s3.IBucket }
  websiteUrls: { [bucketName: string]: string }
  hostedZones: { [zoneName: string]: route53.IHostedZone }
}

/**
 * Props for the MarketplaceLambdaStack
 * Note: Uses SSM Parameter Store for cross-stack references (loose coupling)
 */
export interface MarketplaceLambdaStackProps extends cdk.StackProps {
  envName?: string
}

/**
 * Props for CognitoStack construct
 */
export interface CognitoStackProps {
  envName: string
  postAuthTriggerFunction: any // Lambda Function type from aws-cdk-lib
  hostedZone?: route53.IHostedZone
  customDomainName?: string
}

/**
 * Props for DdbTablesConstruct
 */
export interface DdbTablesConstructProps {
  envName: string
}

/**
 * Props for LambdaConstruct
 */
export interface LambdaConstructProps {
  envVars: Record<string, string>
  envName: string
  tables?: Record<string, dynamodb.ITable>
  queues?: Record<string, { queue: any; queueArn: string; queueName: string }>
  buckets?: Record<string, s3.IBucket>
  userPool: cognito.IUserPool
  userPoolClient: cognito.IUserPoolClient
  hostedZones?: Record<string, route53.IHostedZone>
}
