#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { MarketplaceCertificatesStack } from '../lib/marketplace-certificates-stack'

const app = new cdk.App()
const envName = app.node.tryGetContext('envName') ?? 'dev'

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
}

new MarketplaceCertificatesStack(app, `MarketplaceCertificates-${envName}`, {
  envName,
  env
})

