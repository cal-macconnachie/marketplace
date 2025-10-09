#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { MarketplaceProductsStack } from '../lib/marketplace-products-stack'

const app = new cdk.App()
const envName = app.node.tryGetContext('envName') ?? 'dev'

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
}

// Create products Lambda functions stack
// Depends on: MarketplaceNetworkingStack, MarketplaceInfrastructureStack
new MarketplaceProductsStack(app, `MarketplaceProducts-${envName}`, {
  envName,
  env
})
