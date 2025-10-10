#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { MarketplaceApiDeploymentStack } from '../lib/marketplace-api-deployment-stack'

const app = new cdk.App()
const envName = app.node.tryGetContext('envName') ?? 'dev'

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
}

new MarketplaceApiDeploymentStack(app, `MarketplaceApiDeployment-${envName}`, {
  envName,
  env
})

