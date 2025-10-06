import {
  aws_dynamodb as dynamodb
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import type { DdbTablesConstructProps } from '@marketplace/types'
import { ddbTableDefinitions } from './ddb-table-definitions'

// Helper to map string type to CDK AttributeType
function toAttributeType(type: 'S' | 'N' | 'B'): dynamodb.AttributeType {
  switch (type) {
    case 'S':
      return dynamodb.AttributeType.STRING
    case 'N':
      return dynamodb.AttributeType.NUMBER
    case 'B':
      return dynamodb.AttributeType.BINARY
    default:
      throw new Error(`Unknown attribute type: ${type}`)
  }
}

// Helper to map string projection type to CDK ProjectionType
function toProjectionType(type?: 'ALL' | 'KEYS_ONLY' | 'INCLUDE'): dynamodb.ProjectionType {
  switch (type) {
    case 'KEYS_ONLY':
      return dynamodb.ProjectionType.KEYS_ONLY
    case 'INCLUDE':
      return dynamodb.ProjectionType.INCLUDE
    case 'ALL':
    default:
      return dynamodb.ProjectionType.ALL
  }
}

export class DdbTablesConstruct extends Construct {
  public readonly tables: Record<string, dynamodb.Table>

  constructor(scope: Construct, id: string, props: DdbTablesConstructProps) {
    super(scope, id)
    this.tables = {}

    const { envName } = props

    for (const def of ddbTableDefinitions) {
      const table = new dynamodb.Table(this, def.tableName, {
        tableName: `${def.tableName}-${envName}`,
        partitionKey: {
          name: def.partitionKey.name,
          type: toAttributeType(def.partitionKey.type)
        },
        timeToLiveAttribute: def.ttlAttribute,
        billingMode:
          def.billingMode === 'PAY_PER_REQUEST'
            ? dynamodb.BillingMode.PAY_PER_REQUEST
            : dynamodb.BillingMode.PROVISIONED,
        ...(def.sortKey && {
          sortKey: {
            name: def.sortKey.name,
            type: toAttributeType(def.sortKey.type)
          }
        }),
        ...(def.stream && {
          stream: dynamodb.StreamViewType[def.stream]
        })
      })
      if (def.localSecondaryIndexes) {
        for (const lsi of def.localSecondaryIndexes) {
          table.addLocalSecondaryIndex({
            indexName: lsi.indexName,
            sortKey: {
              name: lsi.sortKey.name,
              type: toAttributeType(lsi.sortKey.type)
            },
            projectionType: toProjectionType(lsi.projectionType),
            nonKeyAttributes: lsi.nonKeyAttributes
          })
        }
      }
      if (def.globalSecondaryIndexes) {
        for (const gsi of def.globalSecondaryIndexes) {
          table.addGlobalSecondaryIndex({
            indexName: gsi.indexName,
            partitionKey: {
              name: gsi.partitionKey.name,
              type: toAttributeType(gsi.partitionKey.type)
            },
            ...(gsi.sortKey && {
              sortKey: {
                name: gsi.sortKey.name,
                type: toAttributeType(gsi.sortKey.type)
              }
            }),
            projectionType: toProjectionType(gsi.projectionType),
            nonKeyAttributes: gsi.nonKeyAttributes
          })
        }
      }
      this.tables[def.tableName] = table
    }
  }
}
