#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { MarketplacePublicStack } from '../lib/marketplace-public-stack'

const app = new cdk.App()
const envName = app.node.tryGetContext('envName') ?? 'dev'

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
}

// Create public Lambda functions stack
// Depends on: MarketplaceNetworkingStack, MarketplaceInfrastructureStack
new MarketplacePublicStack(app, `MarketplacePublic-${envName}`, {
  envName,
  env
})
