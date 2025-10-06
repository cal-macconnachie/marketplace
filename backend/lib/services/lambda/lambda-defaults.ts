import {
  NodejsFunction, NodejsFunctionProps 
} from 'aws-cdk-lib/aws-lambda-nodejs'
import { Construct } from 'constructs'
import { Runtime } from 'aws-cdk-lib/aws-lambda'
import { aws_apigateway as apiGW } from 'aws-cdk-lib'
import * as cdk from 'aws-cdk-lib'
import { BundlingOptions } from 'aws-cdk-lib/aws-lambda-nodejs'

export function createDefaultNodejsFunction(scope: Construct, id: string, props: NodejsFunctionProps) {
  if (!props.entry) {
    throw new Error('Lambda function "entry" (path) is required')
  }
  return new NodejsFunction(scope, id, {
    runtime: Runtime.NODEJS_22_X,
    memorySize: 256,
    timeout: cdk.Duration.seconds(29),
    handler: 'handler',
    bundling: {
      sourceMap: true,
      banner: "require('source-map-support').install();",
      nodeModules: ['source-map-support'],
      ...props.bundling
    },
    ...props
  })
}

/**
 * Creates a Lambda function with native dependency bundling support.
 * Use this when your Lambda requires native binaries like Sharp, Canvas, etc.
 */
export function createNodejsFunctionWithNativeDeps(
  scope: Construct,
  id: string,
  props: NodejsFunctionProps & { nativeBundling: BundlingOptions }
) {
  if (!props.entry) {
    throw new Error('Lambda function "entry" (path) is required')
  }

  const {
    nativeBundling, ...functionProps
  } = props

  return new NodejsFunction(scope, id, {
    runtime: Runtime.NODEJS_22_X,
    memorySize: 512, // Higher memory for native deps
    timeout: cdk.Duration.seconds(60), // Longer timeout for processing
    handler: 'handler',
    bundling: {
      sourceMap: true,
      banner: "require('source-map-support').install();",
      nodeModules: ['source-map-support'],
      ...nativeBundling
    },
    ...functionProps
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function addApiResourceWithApiKey(resource: any, integration: any, method: string = 'GET') {
  resource.addMethod(method, integration, { apiKeyRequired: true })
}
 
export function addApiResourceWithCognito(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resource: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  integration: any,
  authorizer: apiGW.CognitoUserPoolsAuthorizer,
  method: string = 'GET'
) {
  resource.addMethod(method, integration, {
    authorizationType: apiGW.AuthorizationType.COGNITO,
    authorizer
  })
}
 
export function addApiResourcePublic(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resource: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  integration: any,
  method: string = 'GET'
) {
  resource.addMethod(method, integration)
}
