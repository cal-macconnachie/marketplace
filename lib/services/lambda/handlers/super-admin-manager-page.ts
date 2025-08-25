import { readFileSync } from 'fs'
import { join } from 'path'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { getUserByEmail } from '../helpers/users/get-user-by-email'

export const superAdminManagerPage = async (event: APIGatewayProxyEvent) => {
  try {
    // Check for authentication token in headers
    const authHeader = event.headers?.Authorization || event.headers?.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return getLoginPage()
    }

    const token = authHeader.split(' ')[1]
    
    try {
      // Decode the token to get user info (works for both ID and access tokens)
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf-8'))
      const email = payload.email || payload['cognito:username']
      
      if (!email) {
        return getLoginPage('Unable to retrieve user information from token')
      }

      // Verify user exists in our database
      const user = await getUserByEmail(email)
      if (!user) {
        return getLoginPage('User not found in system')
      }

      console.log('User authenticated:', email)

      // User is authenticated, serve the management interface
      const templatePath = join(__dirname, '..', 'templates', 'super-admin-manager.html')
      let htmlTemplate = readFileSync(templatePath, 'utf8')
      
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
      return getLoginPage('Invalid or expired authentication token')
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

function getLoginPage(errorMessage?: string) {
  const errorHtml = errorMessage ? `<div style="color: #dc3545; margin-bottom: 20px; padding: 10px; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px;">${errorMessage}</div>` : ''
  
  return {
    statusCode: 401,
    headers: {
      'Content-Type': 'text/html',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true
    },
    body: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Super Admin Manager - Login</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          
          .login-container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            padding: 40px;
            width: 100%;
            max-width: 400px;
          }
          
          .login-header {
            text-align: center;
            margin-bottom: 30px;
          }
          
          .login-header h1 {
            color: #333;
            font-size: 2rem;
            margin-bottom: 10px;
          }
          
          .login-header p {
            color: #666;
            font-size: 1rem;
          }
          
          .form-group {
            margin-bottom: 20px;
          }
          
          label {
            display: block;
            font-weight: 600;
            margin-bottom: 8px;
            color: #555;
          }
          
          input {
            width: 100%;
            padding: 12px;
            border: 2px solid #e1e5e9;
            border-radius: 8px;
            font-size: 1rem;
            transition: border-color 0.3s;
          }
          
          input:focus {
            outline: none;
            border-color: #635bff;
          }
          
          .btn {
            width: 100%;
            background: linear-gradient(135deg, #635bff 0%, #7c3aed 100%);
            color: white;
            border: none;
            padding: 12px;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
          }
          
          .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(99, 91, 255, 0.3);
          }
          
          .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
          }
          
          .error-message {
            color: #dc3545;
            margin-bottom: 20px;
            padding: 10px;
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            border-radius: 4px;
          }
          
          .loading {
            text-align: center;
            color: #666;
            margin-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="login-container">
          <div class="login-header">
            <h1>Super Admin Manager</h1>
            <p>Please sign in to continue</p>
          </div>
          
          ${errorHtml}
          
          <form id="loginForm">
            <div class="form-group">
              <label for="email">Email</label>
              <input type="email" id="email" required>
            </div>
            
            <div class="form-group">
              <label for="password">Password</label>
              <input type="password" id="password" required>
            </div>
            
            <button type="submit" class="btn" id="loginBtn">Sign In</button>
          </form>
          
          <div id="loadingMessage" class="loading" style="display: none;">Signing in...</div>
        </div>
        
        <script>
          document.getElementById('loginForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const loginBtn = document.getElementById('loginBtn');
            const loadingMessage = document.getElementById('loadingMessage');
            
            if (!email || !password) {
              alert('Please enter both email and password');
              return;
            }
            
            loginBtn.disabled = true;
            loadingMessage.style.display = 'block';
            
            try {
              const envPrefix = '${process.env.NODE_ENV === 'prod' ? '/prod' : '/dev'}';
              const response = await fetch(window.location.origin + envPrefix + '/auth/login', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
              });
              
              const result = await response.json();
              
              if (response.ok && result.idToken) {
                // Store the ID token for page authentication and access token for API calls
                localStorage.setItem('idToken', result.idToken);
                localStorage.setItem('accessToken', result.accessToken);
                
                // Reload the page, which will now include the auth token
                window.location.reload();
              } else {
                alert('Login failed: ' + (result.error || result.message || 'Unknown error'));
              }
            } catch (error) {
              console.error('Login error:', error);
              alert('Login failed: Network error');
            } finally {
              loginBtn.disabled = false;
              loadingMessage.style.display = 'none';
            }
          });
          
          // Check if we have a stored ID token for page authentication
          const storedIdToken = localStorage.getItem('idToken');
          if (storedIdToken) {
            // Try to access the protected page with the stored ID token
            fetch(window.location.href, {
              headers: {
                'Authorization': 'Bearer ' + storedIdToken
              }
            }).then(response => {
              if (response.ok) {
                response.text().then(html => {
                  document.documentElement.innerHTML = html;
                });
              }
            }).catch(console.error);
          }
        </script>
      </body>
      </html>
    `
  }
}