#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { MarketplaceEventsStack } from '../lib/marketplace-events-stack'

const app = new cdk.App()
const envName = app.node.tryGetContext('envName') ?? 'dev'

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
}

// Create event-driven Lambda functions stack (DynamoDB Streams + EventBridge)
// Depends on: MarketplaceInfrastructureStack only (no API Gateway needed)
new MarketplaceEventsStack(app, `MarketplaceEvents-${envName}`, {
  envName,
  env
})
