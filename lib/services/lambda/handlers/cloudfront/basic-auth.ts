import { CloudFrontRequestEvent, CloudFrontRequestResult } from 'aws-lambda'

/**
 * Lambda@Edge function for basic authentication on CloudFront distributions
 * This function intercepts viewer requests and requires HTTP Basic Authentication
 */
export const handler = async (
  event: CloudFrontRequestEvent
): Promise<CloudFrontRequestResult> => {
  const request = event.Records[0].cf.request
  const headers = request.headers

  // Get the Authorization header
  const authHeader = headers.authorization?.[0]?.value

  // Basic auth credentials - in production, these should come from AWS Secrets Manager
  const username = process.env.BASIC_AUTH_USERNAME || 'dev'
  const password = process.env.BASIC_AUTH_PASSWORD || 'dev123'
  const expectedAuth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`

  // Check if the Authorization header matches
  if (!authHeader || authHeader !== expectedAuth) {
    // Return 401 Unauthorized response with WWW-Authenticate header
    return {
      status: '401',
      statusDescription: 'Unauthorized',
      headers: {
        'www-authenticate': [
          {
            key: 'WWW-Authenticate',
            value: 'Basic realm="Protected Site"'
          }
        ],
        'content-type': [
          {
            key: 'Content-Type',
            value: 'text/html'
          }
        ]
      },
      body: '<h1>401 Unauthorized</h1><p>Authentication required.</p>'
    }
  }

  // Authentication successful, pass through the request
  return request
}
