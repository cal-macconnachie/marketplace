import { Construct } from 'constructs'
import {
  aws_apigateway as apiGW,
  aws_ssm as ssm
} from 'aws-cdk-lib'

function sanitizePathForSsm(path: string) {
  return path
    .replace(/^\/+|\/+$/g, '') // trim leading/trailing slashes
    .replaceAll('/', '-')
    .replaceAll('{', '')
    .replaceAll('}', '')
    .replaceAll('*', 'star')
}

export function getOrCreateApiResource(
  scope: Construct,
  api: apiGW.IRestApi,
  envName: string,
  fullPath: string
): apiGW.IResource {
  const segments = fullPath.split('/').filter(Boolean)
  let current: apiGW.IResource = api.root
  let builtPath = ''

  for (const seg of segments) {
    builtPath = builtPath ? `${builtPath}/${seg}` : seg
    const ssmParamName = `/marketplace/${envName}/api-gateway/resource/${sanitizePathForSsm(builtPath)}-id`

    // Try import existing resource from SSM if present
    let existingId: string | undefined
    try {
      existingId = ssm.StringParameter.valueFromLookup(scope, ssmParamName)
    } catch {
      existingId = undefined
    }

    if (existingId) {
      // Import as existing
      current = apiGW.Resource.fromResourceAttributes(scope, `ApiResourceImport-${sanitizePathForSsm(builtPath)}`, {
        restApi: api,
        path: builtPath,
        resourceId: existingId
      })
      continue
    }

    // Otherwise, see if we already created it within this synthesis
    const maybeExisting = current.getResource(seg)
    if (maybeExisting) {
      current = maybeExisting
    } else {
      const created = current.addResource(seg)
      current = created
      // Persist ID to SSM so other stacks can import
      new ssm.StringParameter(scope, `ApiResourceParam-${sanitizePathForSsm(builtPath)}`, {
        parameterName: ssmParamName,
        stringValue: current.resourceId,
        description: `API Gateway Resource ID for /${builtPath}`
      })
    }
  }

  return current
}

