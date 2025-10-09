#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { MarketplaceInternalApiStack } from '../lib/marketplace-internal-api-stack'

const app = new cdk.App()
const envName = app.node.tryGetContext('envName') ?? 'dev'

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
}

// Create internal API Lambda functions stack (auth, orgs, users, images)
// Depends on: MarketplaceNetworkingStack, MarketplaceInfrastructureStack
new MarketplaceInternalApiStack(app, `MarketplaceInternalApi-${envName}`, {
  envName,
  env
})
