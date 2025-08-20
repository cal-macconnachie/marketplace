import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { DdbTablesStack } from './services/dynamodb/ddb-tables-stack'
import { CognitoStack } from './services/cognito/cognito-stack'
import { createDefaultNodejsFunction } from './services/lambda/lambda-defaults'
import path from 'path'
import { LambdaStack } from './services/lambda/lambda-stack'

export class PaymentAuthBackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps & { envName?: string }) {
    super(scope, id, props)
    const envName = props?.envName || 'dev'
    // The code that defines your stack goes here
    const ddbTables = new DdbTablesStack(this, `DdbTablesStack-${envName}`, { envName })
    const postAuthTriggerFunction = createDefaultNodejsFunction(this, `PostAuthTriggerFunction-${envName}`, {
      entry: path.join(__dirname, 'services', 'lambda', 'handlers', 'auth', 'post-auth-trigger.ts'),
      handler: 'postAuthTrigger',
      functionName: `post-auth-trigger-${envName}`,
      description: 'Trigger for post auth in order to create users for social sign on',
      environment: {
        USERS_TABLE_NAME: ddbTables.tables.users.tableName,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 128
    })
    // Grant permissions to the post-auth trigger function
    ddbTables.tables.users.grantReadWriteData(postAuthTriggerFunction)
    const cognitoStack = new CognitoStack(this, `CognitoStack-${envName}`, {
      envName, postAuthTriggerFunction 
    })

    const envVars = {
      'USER_POOL_CLIENT_ID': cognitoStack.userPoolClient.userPoolClientId,
      'USER_POOL_ID': cognitoStack.userPool.userPoolId,
      'STRIPE_SECRET_KEY': `${envName === 'dev' ? process.env.STRIPE_SECRET_KEY_DEV : process.env.STRIPE_SECRET_KEY_PROD}`,
      'STRIPE_EVENT_DESTINATION': `${envName === 'dev' ? process.env.STRIPE_EVENT_DESTINATION_DEV : process.env.STRIPE_EVENT_DESTINATION_PROD}`
    }
    new LambdaStack(this, `LambdaStack-${envName}`, {
      envName,
      envVars,
      userPool: cognitoStack.userPool,
      userPoolClient: cognitoStack.userPoolClient,
      tables: ddbTables.tables,
    })

  }
}
