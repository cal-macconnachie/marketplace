#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { MarketplaceNetworkingStack } from '../lib/marketplace-networking-stack'

const app = new cdk.App()
const envName = app.node.tryGetContext('envName') ?? 'dev'

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
}

// Create networking stack with API Gateway and CloudFront
// Depends on: MarketplaceInfrastructureStack, MarketplaceInternalApiStack (for image processor URL)
// IMPORTANT: Deploy AFTER MarketplaceInfrastructureStack and MarketplaceInternalApiStack
// IMPORTANT: Deploy BEFORE any other domain stacks
new MarketplaceNetworkingStack(app, `MarketplaceNetworking-${envName}`, {
  envName,
  env
})
