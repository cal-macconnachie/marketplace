import { APIGatewayProxyEvent } from 'aws-lambda'
import { getUserByEmail } from '../../helpers/users/get-user-by-email'
import * as fs from 'fs'
import * as path from 'path'

export const superAdminManagerPage = async (event: APIGatewayProxyEvent) => {
  try {
    // Check for authentication token in headers
    const authHeader = event.headers?.Authorization || event.headers?.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 302,
        headers: {
          Location: '/manager/login'
        }
      }
    }

    const token = authHeader.split(' ')[1]
    
    try {
      // Decode the token to get user info (works for both ID and access tokens)
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf-8'))
      const email = payload.email || payload['cognito:username']
      
      if (!email) {
        return {
          statusCode: 302,
          headers: {
            Location: '/manager/login'
          }
        }
      }

      // Verify user exists in our database
      const user = await getUserByEmail(email)
      if (!user) {
        return {
          statusCode: 302,
          headers: {
            Location: '/manager/login'
          }
        }
      }

      console.log('User authenticated:', email)

      // User is authenticated, serve the management interface
      let htmlTemplate = getManagerTemplate()
      
      // Inject the token and environment prefix into the HTML for API calls
      const envPrefix = process.env.NODE_ENV === 'prod' ? '/prod' : '/dev'
      htmlTemplate = htmlTemplate.replace(
        '<script>',
        `<script>
        const AUTH_TOKEN = '${token}';  // ID token for API calls (Cognito authorizer expects this)
        const USER_EMAIL = '${email}';
        const ENV_PREFIX = '${envPrefix}';
        `
      )
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/html',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true
        },
        body: htmlTemplate
      }
      
    } catch (tokenError) {
      console.error('Token validation error:', tokenError)
      // redirect to /manager/login
      return {
        statusCode: 302,
        headers: {
          Location: '/manager/login'
        }
      }
    }
    
  } catch (error) {
    console.error('Error in super admin manager page:', error)
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'text/html'
      },
      body: `
        <html>
          <head>
            <title>Super Admin Manager - Error</title>
          </head>
          <body>
            <h1>Error Loading Super Admin Manager</h1>
            <p>Could not load the management interface. Please check server logs.</p>
            <p>Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
          </body>
        </html>
      `
    }
  }
}

function getManagerTemplate(): string {
  const htmlPath = path.join(__dirname, 'manager/templates/super-admin-manager.html')
  return fs.readFileSync(htmlPath, 'utf-8')
}