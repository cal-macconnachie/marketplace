/**
 * CloudFront Function for basic authentication
 * This runs at CloudFront edge locations (lighter weight than Lambda@Edge)
 *
 * Note: CloudFront Functions use a restricted JavaScript runtime
 * - No Node.js APIs, no async/await, no Buffer
 * - Must compile to ES5-compatible JavaScript
 */

interface CloudFrontRequest {
  headers: Record<string, { value: string }>;
  uri: string;
}

interface CloudFrontEvent {
  request: CloudFrontRequest;
}

interface CloudFrontResponse {
  statusCode: number;
  statusDescription: string;
  headers: Record<string, { value: string }>;
  body: string;
}

export function handler(event: CloudFrontEvent): CloudFrontRequest | CloudFrontResponse {
  var request = event.request
  var headers = request.headers

  // Get the Authorization header
  var authHeader = headers.authorization ? headers.authorization.value : null

  // Basic auth credentials (these will be replaced at deployment time)
  var username = 'CLOUDFRONT_AUTH_USERNAME_PLACEHOLDER'
  var password = 'CLOUDFRONT_AUTH_PASSWORD_PLACEHOLDER'
  var expectedAuth = 'Basic ' + btoa(username + ':' + password)

  // Check if the Authorization header matches
  if (!authHeader || authHeader !== expectedAuth) {
    // Return 401 Unauthorized response
    return {
      statusCode: 401,
      statusDescription: 'Unauthorized',
      headers: {
        'www-authenticate': { value: 'Basic realm="Protected Site"' },
        'content-type': { value: 'text/html' }
      },
      body: '<h1>401 Unauthorized</h1><p>Authentication required.</p>'
    }
  }

  // Authentication successful, pass through the request
  return request
}
