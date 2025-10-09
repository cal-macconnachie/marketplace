import type { LambdaEndpointDefinition } from '@marketplace/types'
import * as cdk from 'aws-cdk-lib'
import * as apiGW from 'aws-cdk-lib/aws-apigateway'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import { Construct } from 'constructs'
import { allEndpointCollections } from './services/lambda/endpoint-definitions'

export interface MarketplaceApiResourcesStackProps extends cdk.StackProps {
  envName?: string
}

interface PathInfo {
  method: string
  stack: string
  handler: string
}

interface ApiResourceNode {
  path: string
  fullPath: string
  methods: Map<string, PathInfo>
  children: Map<string, ApiResourceNode>
}

function sanitizePathForSsm(path: string): string {
  return path
    .replace(/^\/+|\/+$/g, '') // trim leading/trailing slashes
    .replaceAll('/', '-')
    .replaceAll('{', '')
    .replaceAll('}', '')
    .replaceAll('*', 'star')
}

/**
 * API Gateway Resources Stack
 * Pre-creates all API Gateway resources (paths) for all domain stacks
 * Validates that no two stacks attempt to use the same path+method combination
 * Exports all resource IDs to SSM Parameter Store for domain stacks to import
 *
 * This stack should be deployed AFTER MarketplaceNetworkingStack but BEFORE any domain Lambda stacks
 * Dependencies:
 * - MarketplaceNetworkingStack: API Gateway REST API
 */
export class MarketplaceApiResourcesStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: MarketplaceApiResourcesStackProps) {
    super(scope, id, props)
    const envName = props?.envName ?? 'dev'

    // Import API Gateway from SSM (exported by MarketplaceNetworkingStack)
    const restApiId = ssm.StringParameter.valueFromLookup(
      this,
      `/marketplace/${envName}/api-gateway/rest-api-id`
    )
    const rootResourceId = ssm.StringParameter.valueFromLookup(
      this,
      `/marketplace/${envName}/api-gateway/root-resource-id`
    )

    const api = apiGW.RestApi.fromRestApiAttributes(this, 'ApiGateway', {
      restApiId,
      rootResourceId
    })

    // ========================================
    // COLLECT ALL ENDPOINTS FROM ALL STACKS DYNAMICALLY
    // ========================================
    // New endpoint definition files are automatically picked up from allEndpointCollections
    // Just add your new endpoints array to the index.ts export

    const allEndpoints: Array<{ def: LambdaEndpointDefinition; stack: string }> = Object.entries(
      allEndpointCollections
    ).flatMap(([
      stackName,
      endpoints
    ]) =>
      endpoints.map(def => ({
        def,
        stack: stackName
      }))
    )

    // Filter to only endpoints with API Gateway definitions
    const apiEndpoints = allEndpoints.filter(e => e.def.apiGw)

    // ========================================
    // BUILD RESOURCE TREE AND DETECT CONFLICTS
    // ========================================

    const rootNode: ApiResourceNode = {
      path: '',
      fullPath: '',
      methods: new Map(),
      children: new Map()
    }

    const conflicts: string[] = []

    for (const {
      def, stack 
    } of apiEndpoints) {
      if (!def.apiGw) continue

      const path = def.apiGw.path
      const method = def.apiGw.method
      const segments = path.split('/').filter(Boolean)

      // Navigate/build tree
      let currentNode = rootNode
      let builtPath = ''

      for (const segment of segments) {
        builtPath = builtPath ? `${builtPath}/${segment}` : segment

        if (!currentNode.children.has(segment)) {
          currentNode.children.set(segment, {
            path: segment,
            fullPath: builtPath,
            methods: new Map(),
            children: new Map()
          })
        }

        currentNode = currentNode.children.get(segment)!
      }

      // Check for method conflicts
      if (currentNode.methods.has(method)) {
        const existing = currentNode.methods.get(method)!
        conflicts.push(
          `CONFLICT: ${stack} stack's ${def.name} (${method} /${path}) conflicts with ${existing.stack} stack's ${existing.handler}`
        )
      } else {
        currentNode.methods.set(method, {
          method,
          stack,
          handler: def.name
        })
      }
    }

    // ========================================
    // THROW ERROR IF CONFLICTS DETECTED
    // ========================================

    if (conflicts.length > 0) {
      const errorMessage = [
        '═══════════════════════════════════════════════════════════',
        '  API GATEWAY RESOURCE CONFLICTS DETECTED',
        '═══════════════════════════════════════════════════════════',
        '',
        'Multiple domain stacks are attempting to use the same API path',
        'and HTTP method combination. This will cause deployment failures.',
        '',
        'Conflicts found:',
        '',
        ...conflicts.map(c => `  • ${c}`),
        '',
        '═══════════════════════════════════════════════════════════',
        '',
        'Please resolve these conflicts before deploying.'
      ].join('\n')

      throw new Error(errorMessage)
    }

    // ========================================
    // CREATE OR IMPORT ALL API GATEWAY RESOURCES
    // ========================================

    const createdResources = new Map<string, apiGW.IResource>()

    const createResourcesRecursive = (node: ApiResourceNode, parentResource: apiGW.IResource) => {
      for (const [
        segment,
        childNode
      ] of node.children) {
        const fullPath = childNode.fullPath
        const ssmParamName = `/marketplace/${envName}/api-gateway/resource/${sanitizePathForSsm(fullPath)}-id`

        // Try to import existing resource from SSM if it exists
        let resource: apiGW.IResource
        let existingResourceId: string | undefined

        try {
          existingResourceId = ssm.StringParameter.valueFromLookup(this, ssmParamName)
        } catch {
          existingResourceId = undefined
        }

        if (existingResourceId && existingResourceId !== 'dummy-value-for-' + ssmParamName) {
          // Resource already exists, import it
          resource = apiGW.Resource.fromResourceAttributes(
            this,
            `ApiResourceImport-${sanitizePathForSsm(fullPath)}`,
            {
              restApi: api,
              path: `/${fullPath}`,
              resourceId: existingResourceId
            }
          )
        } else {
          // Resource doesn't exist, create it
          resource = parentResource.addResource(segment)

          // Export to SSM for domain stacks to import
          new ssm.StringParameter(this, `ApiResourceParam-${sanitizePathForSsm(fullPath)}`, {
            parameterName: ssmParamName,
            stringValue: resource.resourceId,
            description: `API Gateway Resource ID for /${fullPath}`
          })
        }

        createdResources.set(fullPath, resource)

        // Recurse for children
        createResourcesRecursive(childNode, resource)
      }
    }

    createResourcesRecursive(rootNode, api.root)

    // ========================================
    // OUTPUTS
    // ========================================

    new cdk.CfnOutput(this, 'TotalApiResourcesCreated', {
      value: createdResources.size.toString(),
      description: 'Number of API Gateway resources pre-created'
    })

    new cdk.CfnOutput(this, 'TotalEndpointsValidated', {
      value: apiEndpoints.length.toString(),
      description: 'Number of API endpoints validated for conflicts'
    })

    // Output summary by stack
    const stackCounts = new Map<string, number>()
    for (const { stack } of apiEndpoints) {
      stackCounts.set(stack, (stackCounts.get(stack) || 0) + 1)
    }

    for (const [
      stack,
      count
    ] of stackCounts) {
      new cdk.CfnOutput(this, `${stack}StackEndpoints`, {
        value: count.toString(),
        description: `Number of API endpoints in ${stack} stack`
      })
    }
  }
}
