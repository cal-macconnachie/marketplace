import { Construct } from 'constructs'
import { aws_apigateway as apiGW } from 'aws-cdk-lib'
import * as fs from 'node:fs'
import * as path from 'node:path'

interface ApiResourceMapping {
  resources: Record<string, string>
}

/**
 * Get or create API Gateway resource by reading from pre-generated mapping file
 * The mapping file is created by MarketplaceApiResourcesStack deployment
 */
export function getOrCreateApiResource(
  scope: Construct,
  api: apiGW.IRestApi,
  envName: string,
  fullPath: string
): apiGW.IResource {
  const segments = fullPath.split('/').filter(Boolean)
  let current: apiGW.IResource = api.root
  let builtPath = ''

  // Try to load resource mapping from file
  // Primary: backend/lib/.cdk-outputs
  const mappingPath = path.join(__dirname, '..', '..', '.cdk-outputs', `api-resources-${envName}.json`)
  // Fallback: backend/.cdk-outputs (older location)
  const altMappingPath = path.join(__dirname, '..', '..', '..', '.cdk-outputs', `api-resources-${envName}.json`)
  let resourceMapping: ApiResourceMapping | null = null

  const pathToUse = fs.existsSync(mappingPath) ? mappingPath : (fs.existsSync(altMappingPath) ? altMappingPath : null)
  if (pathToUse) {
    try {
      const content = fs.readFileSync(pathToUse, 'utf-8')
      resourceMapping = JSON.parse(content)
    } catch (error) {
      console.warn(`Failed to read API resource mapping from ${pathToUse}:`, error)
    }
  }

  for (const seg of segments) {
    builtPath = builtPath ? `${builtPath}/${seg}` : seg

    // If we have a mapping file, import the resource
    if (resourceMapping && resourceMapping.resources[builtPath]) {
      const importId = `ApiResourceImport-${builtPath.replace(/[^a-zA-Z0-9]/g, '-')}`
      // Reuse previously imported construct if present to avoid duplicate IDs
      const existing = scope.node.tryFindChild(importId) as unknown as apiGW.IResource | undefined
      if (existing) {
        current = existing
      } else {
        current = apiGW.Resource.fromResourceAttributes(
          scope,
          importId,
          {
            restApi: api,
            path: `/${builtPath}`,
            resourceId: resourceMapping.resources[builtPath]
          }
        )
      }
    } else {
      // Fallback: check if resource already exists in this stack
      const maybeExisting = current.getResource(seg)
      if (maybeExisting) {
        current = maybeExisting
      } else {
        // This shouldn't happen if API Resources stack was deployed first
        console.warn(
          `⚠️  Creating API resource /${builtPath} on-the-fly. ` +
            `Deploy MarketplaceApiResources-${envName} stack first to avoid race conditions.`
        )
        current = current.addResource(seg)
      }
    }
  }

  return current
}
