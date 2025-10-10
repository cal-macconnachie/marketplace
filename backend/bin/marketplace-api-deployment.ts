#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { MarketplaceApiDeploymentStack } from '../lib/marketplace-api-deployment-stack'

const app = new cdk.App()
const envName = app.node.tryGetContext('envName') ?? 'dev'

new MarketplaceApiDeploymentStack(app, `MarketplaceApiDeployment-${envName}`, {
  envName
})
