#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { MarketplaceInfrastructureStack } from '../lib/marketplace-infrastructure-stack'
import { MarketplaceLambdaStack } from '../lib/marketplace-lambda-stack'

const app = new cdk.App()
const envName = app.node.tryGetContext('envName') ?? 'dev'

// Explicit env configuration required for SSM Parameter Store lookups
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
}

// Create infrastructure stack (stable resources)
// Exports values to SSM Parameter Store for loose coupling
new MarketplaceInfrastructureStack(app, `MarketplaceInfrastructure-${envName}`, {
  envName,
  env
})

// Create lambda stack (frequently-changing resources)
// Imports values from SSM Parameter Store - no direct dependency
new MarketplaceLambdaStack(app, `MarketplaceLambda-${envName}`, {
  envName,
  env
})