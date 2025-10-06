#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { MarketplaceInfrastructureStack } from '../lib/marketplace-infrastructure-stack'
import { MarketplaceLambdaStack } from '../lib/marketplace-lambda-stack'

const app = new cdk.App()
const envName = app.node.tryGetContext('envName') ?? 'dev'

// Create infrastructure stack (stable resources)
const infrastructureStack = new MarketplaceInfrastructureStack(app, `MarketplaceInfrastructure-${envName}`, {
  envName
})

// Create lambda stack (frequently-changing resources)
const lambdaStack = new MarketplaceLambdaStack(app, `MarketplaceLambda-${envName}`, {
  envName,
  infrastructureOutputs: infrastructureStack.outputs
})

// Ensure lambda stack depends on infrastructure stack
lambdaStack.addDependency(infrastructureStack)