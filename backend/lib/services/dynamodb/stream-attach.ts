import type { LambdaEndpointDefinition } from '@marketplace/types'
import * as cdk from 'aws-cdk-lib'
import {
  aws_dynamodb as dynamodb, aws_lambda_event_sources as lambdaEventSources,
  aws_ssm as ssm
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { ddbTableDefinitions } from './ddb-table-definitions'

/**
 * Attaches DynamoDB Stream event sources for any endpoints that declare `dynamoStreamEvent`.
 * It dynamically imports table names and stream ARNs from SSM using the conventions
 * exported by the Infrastructure stack, and only attaches for tables present in
 * ddb-table-definitions with streams enabled.
 */
export function attachDynamoStreamsForEndpoints(
  scope: Construct,
  envName: string,
  lambdas: Record<string, cdk.aws_lambda.Function>,
  endpointDefinitions: LambdaEndpointDefinition[]
) {
  // Create a quick lookup for stream-enabled tables from definitions
  const streamEnabledTables = new Set(
    ddbTableDefinitions
      .filter(t => t.stream)
      .map(t => t.tableName)
  )

  const tablesCache: Record<string, dynamodb.ITable> = {}

  for (const def of endpointDefinitions) {
    if (!def.dynamoStreamEvent) continue
    const tableName = def.dynamoStreamEvent.tableName

    // Skip if table isn't stream-enabled in definitions
    if (!streamEnabledTables.has(tableName)) {
      console.warn(
        `⚠️ Stream not enabled for table '${tableName}' in ddb-table-definitions; ` +
        `skipping stream attachment for ${def.name}. Add stream: 'NEW_AND_OLD_IMAGES' to enable.`
      )
      continue
    }

    // Ensure target lambda exists
    const fn = lambdas[def.name]
    if (!fn) {
      console.warn(`⚠️ Lambda not found for endpoint ${def.name}; cannot attach stream source`)
      continue
    }

    // Resolve table name conventionally and import stream ARN from SSM
    const physicalTableName = `${tableName}-${envName}`
    const streamArnParam = ssm.StringParameter.valueFromLookup(scope, `/marketplace/${envName}/dynamodb/${tableName}-stream-arn`)

    // fromTableAttributes does not validate existence at synth; rely on SSM lookup
    let table = tablesCache[tableName]
    if (!table) {
      table = dynamodb.Table.fromTableAttributes(scope, `${tableName}-stream-table`, {
        tableName: physicalTableName,
        tableStreamArn: streamArnParam
      })
      tablesCache[tableName] = table
    }

    const eventSource = new lambdaEventSources.DynamoEventSource(table, {
      startingPosition: cdk.aws_lambda.StartingPosition.LATEST,
      batchSize: def.dynamoStreamEvent.batchSize ?? 100,
      enabled: def.dynamoStreamEvent.enabled ?? true
    })
    fn.addEventSource(eventSource)
  }
}
