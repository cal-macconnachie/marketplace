import * as fs from 'fs'
import * as path from 'path'
export const superAdminManagerLogin = async () => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true
    },
    body: getLoginPage().replace('ENV_PREFIX', process.env.NODE_ENV === 'prod' ? 'prod'  : 'dev')
  }
}

function getLoginPage() {
  const htmlPath = path.join(__dirname, 'manager/templates/login.html')
  return fs.readFileSync(htmlPath, 'utf-8')
}