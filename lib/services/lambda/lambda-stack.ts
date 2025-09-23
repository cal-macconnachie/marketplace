import { Construct } from 'constructs'
import {
  aws_apigateway as apiGW,
  aws_iam,
  aws_dynamodb as dynamodb,
  aws_sqs as sqs,
  aws_lambda_event_sources as lambdaEventSources,
  aws_s3,
  Duration
} from 'aws-cdk-lib'
import { 
  createDefaultNodejsFunction, 
  createNodejsFunctionWithNativeDeps,
  addApiResourceWithApiKey,
  addApiResourceWithCognito,
  addApiResourcePublic
} from './lambda-defaults'
import { createNativeBundlingConfig } from './bundling-configs'
import * as path from 'node:path'
import {
  LambdaEndpointDefinition, lambdaEndpointDefinitions 
} from './lambda-endpoint-definitions'
import * as cdk from 'aws-cdk-lib'

export interface LambdaStackProps extends cdk.StackProps {
  envVars: Record<string, string>
  envName: string
  tables?: Record<string, dynamodb.Table>
  queues?: Record<string, { queue: sqs.IQueue; queueArn: string; queueName: string }>
  buckets?: Record<string, aws_s3.IBucket>
  userPool: cdk.aws_cognito.UserPool
  userPoolClient: cdk.aws_cognito.UserPoolClient
}

export class LambdaStack extends cdk.Stack {
  public readonly lambdas: Record<string, unknown> = {}
  public readonly api: apiGW.RestApi
  public readonly apiKey: apiGW.IApiKey
  public readonly usagePlan: apiGW.UsagePlan
  public readonly cognitoAuthorizer: apiGW.CognitoUserPoolsAuthorizer
  public readonly imageLambdaUrl?: string
  private readonly corsEnabledResources = new Set<string>()

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props)
    const {
      envVars, envName, userPool 
    } = props
    // Create API Gateway and Cognito Authorizer here
    this.api = new apiGW.RestApi(this, `ApiGwEndpoint-${envName}`, {
      restApiName: `${envName}`,
      description: `API Gateway for Generic Lambda Stack in ${envName} environment`,
      deployOptions: { stageName: envName },
      binaryMediaTypes: ['text/html']
    })
    // Ensure API Gateway adds CORS headers on gateway-generated errors (e.g., 401/403)
    const corsErrorHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': "'*'",
      'Access-Control-Allow-Headers':
        "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Requested-With'",
      'Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,PATCH,OPTIONS'"
    }
    this.api.addGatewayResponse('Default4XX', {
      type: apiGW.ResponseType.DEFAULT_4XX,
      responseHeaders: corsErrorHeaders
    })
    this.api.addGatewayResponse('Default5XX', {
      type: apiGW.ResponseType.DEFAULT_5XX,
      responseHeaders: corsErrorHeaders
    })
    this.api.addGatewayResponse('Unauthorized', {
      type: apiGW.ResponseType.UNAUTHORIZED,
      responseHeaders: corsErrorHeaders
    })
    this.api.addGatewayResponse('AccessDenied', {
      type: apiGW.ResponseType.ACCESS_DENIED,
      responseHeaders: corsErrorHeaders
    })
    this.api.addGatewayResponse('MissingAuthToken', {
      type: apiGW.ResponseType.MISSING_AUTHENTICATION_TOKEN,
      responseHeaders: corsErrorHeaders
    })
    this.apiKey = this.api.addApiKey('ApiKey')
    this.usagePlan = this.api.addUsagePlan('UsagePlan', {
      name: 'DefaultUsagePlan',
      throttle: { 
        rateLimit: 100, // requests per second
        burstLimit: 200 // burst capacity
      },
      quota: {
        limit: 10000, // daily quota
        period: apiGW.Period.DAY
      }
    })
    this.usagePlan.addApiKey(this.apiKey)
    this.usagePlan.addApiStage({
      stage: this.api.deploymentStage
    })
    this.cognitoAuthorizer = new apiGW.CognitoUserPoolsAuthorizer(
      this,
      `CognitoAuthorizer-${envName}`,
      {
        cognitoUserPools: [userPool],
        authorizerName: `CognitoAuthorizer-${envName}`
      }
    )
    const endpointDefs: LambdaEndpointDefinition[] = lambdaEndpointDefinitions

    for (const def of endpointDefs) {
      // Prepare environment variables, including table names if needed
      const lambdaEnv: Record<string, string> = {
        NODE_ENV: envName,
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
      // Add table environment variables
      if (props.tables) {
        for (const tableName of Object.keys(props.tables)) {
          const table = props.tables[tableName]
          if (table) {
            const envVarName = `${tableName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}_TABLE`
            lambdaEnv[envVarName] = table.tableName
          }
        }
      }
      // Add queue environment variables
      if (def.queues && props.queues) {
        for (const queueName of def.queues) {
          const queueObj = props.queues[queueName]
          if (queueObj) {
            // Environment variable name: QUEUE_<QUEUE_NAME>, QUEUE_<QUEUE_NAME>_ARN, and QUEUE_<QUEUE_NAME>_URL
            const envVarBase = `QUEUE_${queueName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`
            lambdaEnv[envVarBase] = queueObj.queueName
            lambdaEnv[`${envVarBase}_ARN`] = queueObj.queueArn
            // Add queue URL if available
            if (queueObj.queue && typeof queueObj.queue.queueUrl === 'string') {
              lambdaEnv[`${envVarBase}_URL`] = queueObj.queue.queueUrl
            }
          }
        }
      }
      // Add S3 bucket environment variables BEFORE Lambda creation
      if (def.buckets && props.buckets) {
        for (const bucketName of def.buckets) {
          const bucket = props.buckets[bucketName]
          if (bucket) {
            lambdaEnv[`BUCKET_${bucketName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`] =
              bucket.bucketName
          } else {
            console.warn(`Bucket ${bucketName} not found for Lambda ${def.name}`)
          }
        }
      }
      // Prepare bundling options for template files if specified (supports nested directories under templates/)
      const bundlingOptions = def.bundleTemplate ? {
        commandHooks: {
          beforeBundling: () => [],
          beforeInstall: () => [],
          afterBundling: (inputDir: string, outputDir: string): string[] => {
            const copyCommands = def.bundleTemplate!.map(file => {
              const src = path.join(inputDir, 'lib/services/lambda/templates', file)
              const destDir = path.join(outputDir, path.dirname(file))
              const dest = path.join(outputDir, file)
              return `mkdir -p "${destDir}" 2>/dev/null || true && cp "${src}" "${dest}" 2>/dev/null || true`
            })
            return copyCommands
          }
        }
      } : undefined

      // Now create the Lambda function
      let fn
      if (def.requiresNativeDeps) {
        // Use native bundling configuration for functions that need it
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
          memorySize: def.memorySize || 512, // Higher default for native deps
          nativeBundling,
          ...(def.streaming ? { invokeMode: 'RESPONSE_STREAM' } : {})
        })
      } else {
        // Use standard configuration for regular functions
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
      // Attach IAM policies if specified
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
      // Grant DynamoDB table access if specified
      if (props.tables) {
        for (const tableName of Object.keys(props.tables)) {
          const table = props.tables[tableName]
          if (table) {
            table.grantReadWriteData(fn)
          } else {
            console.warn(`Table ${tableName} not found for Lambda ${def.name}`)
          }
        }
      }
      // Grant SQS queue access if specified
      if (def.queues && props.queues) {
        for (const queueName of def.queues) {
          const queueObj = props.queues[queueName]
          if (
            queueObj &&
            queueObj.queue &&
            typeof queueObj.queue.grantSendMessages === 'function'
          ) {
            queueObj.queue.grantSendMessages(fn)
          }
        }
      }
      // Grant S3 bucket access if specified (after Lambda creation)
      if (def.buckets && props.buckets) {
        for (const bucketName of def.buckets) {
          const bucket = props.buckets[bucketName]
          if (bucket) {
            bucket.grantReadWrite(fn)
          }
        }
      }
      // Attach SQS event source if queueEvent is defined
      if (def.queueEvent && props.queues) {
        const {
          queueName, batchSize, enabled 
        } = def.queueEvent
        const queueObj = props.queues[queueName]
        if (queueObj && queueObj.queue) {
          const eventSource = new lambdaEventSources.SqsEventSource(queueObj.queue, {
            batchSize: batchSize ?? 10,
            enabled: enabled ?? true
          })
          fn.addEventSource(eventSource)
        } else {
          console.warn(`Queue ${queueName} not found for Lambda ${def.name} queueEvent`)
        }
      }
      // Attach DynamoDB stream event source if dynamoStreamEvent is defined
      if (def.dynamoStreamEvent && props.tables) {
        const {
          tableName, batchSize, enabled 
        } = def.dynamoStreamEvent
        const table = props.tables[tableName]
        if (table) {
          const eventSource = new lambdaEventSources.DynamoEventSource(table, {
            startingPosition: cdk.aws_lambda.StartingPosition.LATEST,
            batchSize: batchSize ?? 100,
            enabled: enabled ?? true
          })
          fn.addEventSource(eventSource)
        } else {
          console.warn(`Table ${tableName} not found for Lambda ${def.name} dynamoStreamEvent`)
        }
      }
      // Attach EventBridge event source if eventBridgeEvent is defined
      if (def.eventBridgeEvent) {
        const events = cdk.aws_events
        const eventsTargets = cdk.aws_events_targets
        let eventBusName = 'default'
        if (def.eventBridgeEvent.detailType === 'Stripe Event' && envVars['STRIPE_EVENT_DESTINATION']) {
          const stripeEventDestination = envVars['STRIPE_EVENT_DESTINATION']
          if (stripeEventDestination) {
            eventBusName = `aws.partner/stripe.com/${stripeEventDestination}`
          }
        } else if (def.eventBridgeEvent.detailType === 'Stripe Event' && envVars['STRIPE_EVENT_DESTINATION_PLATFORM']) {
          const platformEventDestination = envVars['STRIPE_EVENT_DESTINATION_PLATFORM']
          if (platformEventDestination) {
            eventBusName = `aws.partner/stripe.com/${platformEventDestination}`
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
      if (def.apiGw) {
        // Create API Gateway resource and method with support for nested paths
        const pathSegments = def.apiGw.path.split('/')
        let resource: apiGW.Resource = this.api.root as apiGW.Resource
        
        // Create nested resources for each path segment
        for (const segment of pathSegments) {
          if (segment) { // Skip empty segments
            const existingResource = resource.getResource(segment)
            if (existingResource) {
              resource = existingResource as apiGW.Resource
            } else {
              resource = resource.addResource(segment)
            }
          }
        }
        
        const integration = new apiGW.LambdaIntegration(fn)
        // Enable CORS if specified (only once per resource path)
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
        if (def.apiGw.auth === 'apiKey') {
          addApiResourceWithApiKey(resource, integration, def.apiGw.method)
        } else if (def.apiGw.auth === 'cognito') {
          addApiResourceWithCognito(resource, integration, this.cognitoAuthorizer, def.apiGw.method)
        } else {
          addApiResourcePublic(resource, integration, def.apiGw.method)
        }
      }
    }
  }
}
