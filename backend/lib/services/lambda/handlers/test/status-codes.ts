import { APIGatewayProxyEvent } from 'aws-lambda'

export const STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500
}
export const checkStatusCode = async (event: APIGatewayProxyEvent) => {
  const status = event.pathParameters?.status_code ?? '200'
  const statusCode = parseInt(status, 10)
  if (isNaN(statusCode)) {
    return {
      statusCode: STATUS_CODES.BAD_REQUEST,
      body: JSON.stringify({ message: 'Invalid status code' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
  if (statusCode === STATUS_CODES.OK) {
    // Handle OK
    return {
      statusCode: STATUS_CODES.OK,
      body: JSON.stringify({ message: 'OK' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } else if (statusCode === STATUS_CODES.CREATED) {
    // Handle CREATED
    return {
      statusCode: STATUS_CODES.CREATED,
      body: JSON.stringify({ message: 'Created' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } else if (statusCode === STATUS_CODES.NO_CONTENT) {
    // Handle NO_CONTENT
    return {
      statusCode: STATUS_CODES.NO_CONTENT,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      }
    }
  } else if (statusCode === STATUS_CODES.BAD_REQUEST) {
    // Handle BAD_REQUEST
    return {
      statusCode: STATUS_CODES.BAD_REQUEST,
      body: JSON.stringify({ message: 'Bad Request' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } else if (statusCode === STATUS_CODES.UNAUTHORIZED) {
    // Handle UNAUTHORIZED
    return {
      statusCode: STATUS_CODES.UNAUTHORIZED,
      body: JSON.stringify({ message: 'Unauthorized' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } else if (statusCode === STATUS_CODES.FORBIDDEN) {
    // Handle FORBIDDEN
    return {
      statusCode: STATUS_CODES.FORBIDDEN,
      body: JSON.stringify({ message: 'Forbidden' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } else if (statusCode === STATUS_CODES.NOT_FOUND) {
    // Handle NOT_FOUND
    return {
      statusCode: STATUS_CODES.NOT_FOUND,
      body: JSON.stringify({ message: 'Not Found' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } else if (statusCode === STATUS_CODES.CONFLICT) {
    // Handle CONFLICT
    return {
      statusCode: STATUS_CODES.CONFLICT,
      body: JSON.stringify({ message: 'Conflict' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } else if (statusCode === STATUS_CODES.INTERNAL_SERVER_ERROR) {
    // Handle INTERNAL_SERVER_ERROR
    return {
      statusCode: STATUS_CODES.INTERNAL_SERVER_ERROR,
      body: JSON.stringify({ message: 'Internal Server Error' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
  return {
    statusCode: STATUS_CODES.NOT_FOUND,
    body: JSON.stringify({ message: 'Not Found' }),
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
      'Content-Type': 'application/json'
    }
  }
}