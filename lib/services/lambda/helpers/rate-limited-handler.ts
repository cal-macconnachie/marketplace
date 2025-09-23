import {
  Handler, Context, Callback 
} from 'aws-lambda'
import {
  APIGatewayProxyEvent, APIGatewayProxyResult 
} from 'aws-lambda'
import { checkRateLimit } from './rate-limiting/dynamo-rate-limiter'

type APIGatewayHandler = (
  event: APIGatewayProxyEvent,
  context: Context,
  callback?: Callback<APIGatewayProxyResult>
) => Promise<APIGatewayProxyResult>

export const rateLimitedHandler = (
  handler: APIGatewayHandler,
  options: {
    windowMs: number
    maxRequests: number
  } = {
    windowMs: 60 * 1000, // 1 minute window
    maxRequests: 5 // 5 requests per minute per authed user
  }
): Handler<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  return async (event, context, callback) => {
    // if no authed user then by ip
    const startOfAccessKey = event.requestContext.authorizer?.claims.email ?? event.requestContext.identity.sourceIp
    const accessKey = `${startOfAccessKey}:${handler.name}`
    const {
      allowed,
      resetTime,
      remaining
    } = await checkRateLimit(accessKey, options)

    if (!allowed) {
      return {
        statusCode: 429,
        body: JSON.stringify({
          message: 'Rate limit exceeded',
          maxRequests: options.maxRequests,
          resetTime,
          remaining
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    const res = await handler(event, context, callback)

    return Promise.resolve({
      ...res,
      headers: {
        ...res.headers,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      }
    })
  }
}
