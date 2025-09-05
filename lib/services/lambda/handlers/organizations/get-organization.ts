import { APIGatewayProxyEvent } from 'aws-lambda'
import { getOrganizationById } from '../../helpers/organizations/get-organization-by-id'

export const publicGetOrganization = async (event: APIGatewayProxyEvent) => {
  const { id } = event.pathParameters ?? {}
  if (!id) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing organization ID' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
  const org = await getOrganizationById(id)
  if (org == null) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Organization not found' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
  const publicOrgAttributes: (keyof typeof org)[] = [
    'id',
    'name'
  ]
  return {
    statusCode: 200,
    body: JSON.stringify(Object.fromEntries(publicOrgAttributes.map(attr => [
      attr,
      org[attr]
    ]))),
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
      'Content-Type': 'application/json'
    }
  }
}

export const getOrganization = async (event: APIGatewayProxyEvent) => {
  const { id } = JSON.parse(event.body ?? '{}')
  if (!id) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing organization ID' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
  const org = await getOrganizationById(id)
  if (!org) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Organization not found' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
  return {
    statusCode: 200,
    body: JSON.stringify(org),
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
      'Content-Type': 'application/json'
    }
  }
}
