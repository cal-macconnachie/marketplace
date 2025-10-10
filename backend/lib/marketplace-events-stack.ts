import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { attachDynamoStreamsForEndpoints } from './services/dynamodb/stream-attach'
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

    const envVars = {
      'ENV_NAME': envName,
      'STRIPE_SECRET_KEY': `${envName === 'dev' ? process.env.STRIPE_SECRET_KEY_DEV : process.env.STRIPE_SECRET_KEY_PROD}`,
      'STRIPE_EVENT_DESTINATION': `${envName === 'dev' ? process.env.STRIPE_EVENT_DESTINATION_DEV : process.env.STRIPE_EVENT_DESTINATION_PROD}`,
      'STRIPE_EVENT_DESTINATION_PLATFORM': `${envName === 'dev' ? process.env.STRIPE_EVENT_DESTINATION_PLATFORM_DEV : process.env.STRIPE_EVENT_DESTINATION_PLATFORM_PROD}`,
      'EMAIL_AWS_REGION': process.env.EMAIL_AWS_REGION ?? '',
      'EMAIL_LAMBDA_ARN': process.env.EMAIL_LAMBDA_ARN ?? '',
      'SMS_LAMBDA_ARN': process.env.SMS_LAMBDA_ARN ?? '',
      'EMAIL_ASSUME_ROLE_ARN': process.env.EMAIL_ASSUME_ROLE_ARN ?? ''
    }

    // Create event-driven Lambda functions (no API Gateway needed)
    const eventsConstruct = new DomainLambdaConstruct(this, `EventsLambdas-${envName}`, {
      envName,
      envVars,
      endpointDefinitions: eventsEndpoints,
      // Note: api and cognitoAuthorizer are NOT provided - these are event-driven only
    })

    // Attach DynamoDB Streams to the appropriate lambdas dynamically
    attachDynamoStreamsForEndpoints(this, envName, eventsConstruct.lambdas, eventsEndpoints)

    new cdk.CfnOutput(this, 'EventsLambdasDeployed', {
      value: eventsEndpoints.length.toString(),
      description: 'Number of event-driven Lambda functions deployed'
    })
  }
}
