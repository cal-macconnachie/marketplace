import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Construct } from 'constructs'
import { Runtime } from 'aws-cdk-lib/aws-lambda'
import * as cdk from 'aws-cdk-lib'

export function createDefaultNodejsFunction(
scope: Construct, id: string, props: NodejsFunctionProps) {
  if (!props.entry) {
    throw new Error('Lambda function "entry" (path) is required')
  }
  return new NodejsFunction(scope, id, {
    runtime: Runtime.NODEJS_22_X,
    memorySize: 256,
    timeout: cdk.Duration.seconds(29),
    handler: 'handler',
    ...props
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function addApiResourceWithApiKey(resource: any, integration: any, method: string = 'GET') {
  resource.addMethod(method, integration, { apiKeyRequired: true })
}
