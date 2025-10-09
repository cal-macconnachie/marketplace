#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { MarketplaceApiResourcesStack } from '../lib/marketplace-api-resources-stack'

const app = new cdk.App()
const envName = app.node.tryGetContext('envName') ?? 'dev'

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
}

// Create API Gateway Resources stack
// Pre-creates all API Gateway resources and validates no path+method conflicts exist
// Depends on: MarketplaceNetworkingStack (for API Gateway)
// IMPORTANT: Deploy AFTER MarketplaceNetworkingStack
// IMPORTANT: Deploy BEFORE any domain Lambda stacks (Public, Payments, Products, InternalApi)
new MarketplaceApiResourcesStack(app, `MarketplaceApiResources-${envName}`, {
  envName,
  env
})
