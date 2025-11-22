import type { LambdaEndpointDefinition } from '@marketplace/types'
import * as cdk from 'aws-cdk-lib'
import {
  aws_apigateway as apiGW,
  aws_iam,
  Duration,
  aws_lambda_event_sources as lambdaEventSources,
  aws_sqs as sqs
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as path from 'node:path'
import { getOrCreateApiResource } from '../apigateway/resource-utils'
import { ddbTableDefinitions } from '../dynamodb/ddb-table-definitions'
import { createNativeBundlingConfig } from './bundling-configs'
import {
  addApiResourcePublic,
  addApiResourceWithApiKey,
  addApiResourceWithCognito,
  createDefaultNodejsFunction,
  createNodejsFunctionWithNativeDeps
} from './lambda-defaults'

export interface DomainLambdaConstructProps {
  envName: string
  envVars: Record<string, string>
  endpointDefinitions: LambdaEndpointDefinition[]
  // Optional API Gateway resources (not needed for event-driven stacks)
  api?: apiGW.IRestApi
  cognitoAuthorizer?: apiGW.CognitoUserPoolsAuthorizer
  queues?: Record<string, { queue: sqs.IQueue; queueName: string; queueArn: string }>
}

/**
 * Reusable construct for creating Lambda functions in domain-specific stacks
 * Handles Lambda creation, API Gateway integration, DynamoDB/SQS permissions, and event sources
 */
export class DomainLambdaConstruct extends Construct {
  public readonly lambdas: Record<string, cdk.aws_lambda.Function> = {}
  public readonly imageLambdaUrl?: string
  private readonly corsEnabledResources = new Set<string>()

  constructor(scope: Construct, id: string, props: DomainLambdaConstructProps) {
    super(scope, id)
    const {
      envVars, envName, endpointDefinitions, api, cognitoAuthorizer, queues 
    } = props

    for (const def of endpointDefinitions) {
      // Prepare environment variables
      const lambdaEnv: Record<string, string> = {
        NODE_ENV: envName,
        ENV_NAME: envName,
        ...def.environment?.reduce((acc: { [envKey: string]: string }, key: string) => {
          const value = envVars[`${key}_${envName.toUpperCase()}`] ?? envVars[key]
          if (value) {
            acc[key] = value
          } else {
            console.warn(`Environment variable ${key} is not set, skipping for ${def.name}`)
          }
          return acc
        }, {})
      }

      // Add queue environment variables
      if (def.queues && queues) {
        for (const queueName of def.queues) {
          const queueObj = queues[queueName]
          if (queueObj) {
            const envVarBase = `QUEUE_${queueName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`
            lambdaEnv[envVarBase] = queueObj.queueName
            lambdaEnv[`${envVarBase}_ARN`] = queueObj.queueArn
            if (queueObj.queue && typeof queueObj.queue.queueUrl === 'string') {
              lambdaEnv[`${envVarBase}_URL`] = queueObj.queue.queueUrl
            }
          }
        }
      }

      // Add S3 bucket environment variables
      if (def.buckets) {
        for (const bucketName of def.buckets) {
          lambdaEnv[`BUCKET_${bucketName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`] =
            `${envName}-${bucketName}`
        }
      }

      // Prepare bundling options for template files
      // IMPORTANT: forceDockerBundling must be true for commandHooks.afterBundling to execute
      const bundlingOptions = def.bundleTemplate ? {
        sourceMap: true,
        banner: "require('source-map-support').install();",
        nodeModules: ['source-map-support'],
        forceDockerBundling: true, // Required for commandHooks to work
        commandHooks: {
          beforeBundling: () => [],
          beforeInstall: () => [],
          afterBundling: (inputDir: string, outputDir: string): string[] => {
            const copyCommands = def.bundleTemplate!.map(file => {
              // In Docker, inputDir is /asset-input which is the repo root
              // Template files are at backend/lib/services/lambda/templates/
              const src = path.join(inputDir, 'backend/lib/services/lambda/templates', file)
              const dest = path.join(outputDir, file)
              return `cp "${src}" "${dest}"`
            })
            return copyCommands
          }
        }
      } : undefined

      // Create the Lambda function
      let fn
      if (def.requiresNativeDeps) {
        const nativeBundling = createNativeBundlingConfig({
          bundleTemplate: def.bundleTemplate
        })
        fn = createNodejsFunctionWithNativeDeps(this, `${def.name}-${envName}`, {
          entry: path.join(__dirname, 'handlers', `${def.handler.split('.')[0]}.ts`),
          handler: def.handler.split('.')[1],
          functionName: `${def.name}-${envName}`,
          description: def.description,
          environment: lambdaEnv,
          timeout: def.timeout ? Duration.seconds(def.timeout) : Duration.seconds(30),
          memorySize: def.memorySize || 512,
          nativeBundling,
          ...(def.streaming ? { invokeMode: 'RESPONSE_STREAM' } : {})
        })
      } else {
        fn = createDefaultNodejsFunction(this, `${def.name}-${envName}`, {
          entry: path.join(__dirname, 'handlers', `${def.handler.split('.')[0]}.ts`),
          handler: def.handler.split('.')[1],
          functionName: `${def.name}-${envName}`,
          description: def.description,
          environment: lambdaEnv,
          timeout: def.timeout ? Duration.seconds(def.timeout) : Duration.seconds(30),
          memorySize: def.memorySize || 128,
          ...(def.streaming ? { invokeMode: 'RESPONSE_STREAM' } : {}),
          ...(bundlingOptions ? { bundling: bundlingOptions } : {})
        })
      }

      this.lambdas[def.name] = fn

      // Grant DynamoDB access to ALL tables defined in ddb-table-definitions by default
      // This removes the need to thread table objects through every stack.
      try {
        const stack = cdk.Stack.of(this)
        const allTableArns: string[] = []
        for (const t of ddbTableDefinitions) {
          const tableName = `${t.tableName}-${envName}`
          const tableArn = stack.formatArn({
            service: 'dynamodb', resource: 'table', resourceName: tableName 
          })
          allTableArns.push(tableArn)
          allTableArns.push(`${tableArn}/index/*`)
        }
        fn.addToRolePolicy(
          new aws_iam.PolicyStatement({
            actions: [
              'dynamodb:GetItem',
              'dynamodb:PutItem',
              'dynamodb:UpdateItem',
              'dynamodb:DeleteItem',
              'dynamodb:Query',
              'dynamodb:Scan',
              'dynamodb:BatchGetItem',
              'dynamodb:BatchWriteItem',
              'dynamodb:DescribeTable'
            ],
            resources: allTableArns
          })
        )
      } catch (e) {
        console.warn('Warning: failed to attach default DynamoDB permissions for all tables', e)
      }

      // Create function URL for image processor for CloudFront integration
      if (def.name === 'processImage') {
        const functionUrl = fn.addFunctionUrl({
          authType: cdk.aws_lambda.FunctionUrlAuthType.NONE,
          cors: {
            allowedOrigins: ['*'],
            allowedMethods: [cdk.aws_lambda.HttpMethod.GET],
            allowedHeaders: ['*']
          }
        })
        this.imageLambdaUrl = functionUrl.url
      }

      // Attach IAM policies
      if (def.iamPolicies) {
        for (const policy of def.iamPolicies) {
          fn.addToRolePolicy(
            new aws_iam.PolicyStatement({
              actions: policy.actions,
              resources: policy.resources
            })
          )
        }
      }

      // Grant SQS queue access
      if (def.queues && queues) {
        for (const queueName of def.queues) {
          const queueObj = queues[queueName]
          if (queueObj?.queue && typeof queueObj.queue.grantSendMessages === 'function') {
            queueObj.queue.grantSendMessages(fn)
          }
        }
      }

      // Grant S3 bucket access
      if (def.buckets) {
        for (const bucketName of def.buckets) {
          fn.addToRolePolicy(
            new aws_iam.PolicyStatement({
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
                's3:ListBucket'
              ],
              resources: [
                `arn:aws:s3:::${envName}-${bucketName}`,
                `arn:aws:s3:::${envName}-${bucketName}/*`
              ]
            })
          )
        }
      }

      // Attach SQS event source
      if (def.queueEvent && queues) {
        const {
          queueName, batchSize, enabled 
        } = def.queueEvent
        const queueObj = queues[queueName]
        if (queueObj?.queue) {
          const eventSource = new lambdaEventSources.SqsEventSource(queueObj.queue, {
            batchSize: batchSize ?? 10,
            enabled: enabled ?? true
          })
          fn.addEventSource(eventSource)
        }
      }

      // DynamoDB stream event sources are attached by the Events stack via a dedicated helper.

      // Attach EventBridge schedule
      if (def.scheduleEvent) {
        const events = cdk.aws_events
        const eventsTargets = cdk.aws_events_targets
        const rule = new events.Rule(this, `${def.name}ScheduleRule`, {
          schedule: events.Schedule.expression(def.scheduleEvent.rate),
          enabled: def.scheduleEvent.enabled ?? true
        })
        rule.addTarget(new eventsTargets.LambdaFunction(fn))
      }

      // Attach EventBridge event source
      if (def.eventBridgeEvent) {
        const events = cdk.aws_events
        const eventsTargets = cdk.aws_events_targets
        let eventBusName = 'default'

        if (def.eventBridgeEvent.detailType === 'Stripe Event') {
          if (def.environment?.includes('STRIPE_EVENT_DESTINATION_PLATFORM') && envVars['STRIPE_EVENT_DESTINATION_PLATFORM']) {
            const platformEventDestination = envVars['STRIPE_EVENT_DESTINATION_PLATFORM']
            eventBusName = `aws.partner/stripe.com/${platformEventDestination}`
          } else if (def.environment?.includes('STRIPE_EVENT_DESTINATION') && envVars['STRIPE_EVENT_DESTINATION']) {
            const stripeEventDestination = envVars['STRIPE_EVENT_DESTINATION']
            eventBusName = `aws.partner/stripe.com/${stripeEventDestination}`
          }
        } else if (def.eventBridgeEvent.eventBus) {
          eventBusName = def.eventBridgeEvent.eventBus
        }

        const eventBus = events.EventBus.fromEventBusName(
          this,
          `EventBus-${def.name}-${envName}`,
          eventBusName
        )
        const rule = new events.Rule(this, `${def.name}EventBridgeRule`, {
          eventPattern: def.eventBridgeEvent.pattern ?? {
            detailType: [def.eventBridgeEvent.detailType]
          },
          enabled: def.eventBridgeEvent.enabled ?? true,
          eventBus
        })
        rule.addTarget(new eventsTargets.LambdaFunction(fn))
      }

      // Create API Gateway integration (if API Gateway is provided and apiGw is defined)
      if (def.apiGw && api) {
        // Reuse or create API Gateway resources consistently across stacks
        const resource = getOrCreateApiResource(this, api, envName, def.apiGw.path)

        const integration = new apiGW.LambdaIntegration(fn)

        // Enable CORS if specified
        if (def.apiGw.cors) {
          const resourcePath = def.apiGw.path
          if (!this.corsEnabledResources.has(resourcePath)) {
            resource.addCorsPreflight({
              allowOrigins: apiGW.Cors.ALL_ORIGINS,
              allowMethods: apiGW.Cors.ALL_METHODS,
              allowHeaders: [
                ...apiGW.Cors.DEFAULT_HEADERS,
                'Authorization',
                'X-Requested-With'
              ]
            })
            this.corsEnabledResources.add(resourcePath)
          }
        }

        // Add method based on auth type
        if (def.apiGw.auth === 'apiKey') {
          addApiResourceWithApiKey(resource, integration, def.apiGw.method)
        } else if (def.apiGw.auth === 'cognito') {
          if (!cognitoAuthorizer) {
            throw new Error(`Cognito authorizer required for ${def.name} but not provided`)
          }
          addApiResourceWithCognito(resource, integration, cognitoAuthorizer, def.apiGw.method)
        } else {
          addApiResourcePublic(resource, integration, def.apiGw.method)
        }
      }
    }
  }
}
