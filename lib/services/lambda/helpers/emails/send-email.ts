import {
  InvokeCommand, LambdaClient 
} from '@aws-sdk/client-lambda'
import { fromTemporaryCredentials } from '@aws-sdk/credential-providers'

export interface SendEmailParams {
    to: string
    cc?: string[]
    bcc?: string[]
    reply_to?: string
    from?: string
    subject: string
    body: string
}
/*
Use this function to wire up your email sending logic.

I'm using a lambda set up in a different aws account since i already had that system built out and production approved
*/
// Read static config once at module load for Lambda container reuse
const targetArn = process.env.EMAIL_LAMBDA_ARN
const targetRegion = process.env.EMAIL_AWS_REGION
const assumeRoleArn = process.env.EMAIL_ASSUME_ROLE_ARN

// Cache credentials/client across warm invocations (no invalidation here by design)
let cachedClient: LambdaClient | null = null

async function getLambdaClient(): Promise<LambdaClient> {
  if (cachedClient) return cachedClient

  if (!targetArn) throw new Error('EMAIL_LAMBDA_ARN is not set')
  if (!targetRegion) throw new Error('EMAIL_AWS_REGION is not set')

  if (assumeRoleArn) {
    cachedClient = new LambdaClient({
      region: targetRegion,
      credentials: fromTemporaryCredentials({
        clientConfig: { region: targetRegion },
        params: {
          RoleArn: assumeRoleArn,
          RoleSessionName: 'send-email-cross-account',
        },
      }),
    })
  } else {
    cachedClient = new LambdaClient({ region: targetRegion })
  }
  return cachedClient
}

export async function sendEmail(params: SendEmailParams): Promise<void> {
  // Cross-account invoke.
  // - If EMAIL_ASSUME_ROLE_ARN is set, assume that role in the target account first.
  // - Otherwise, invoke directly (requires resource policy on target Lambda to allow current principal).
  const client = await getLambdaClient()

  const payload = {
    to: params.to,
    cc: params.cc,
    bcc: params.bcc,
    reply_to: params.reply_to,
    from: params.from,
    subject: params.subject,
    body: params.body,
  }
  console.log({
    to: params.to,
    cc: params.cc,
    bcc: params.bcc,
    reply_to: params.reply_to,
    from: params.from,
    subject: params.subject,
    body: params.body.length
  })

  const command = new InvokeCommand({
    FunctionName: targetArn!, // full ARN for cross-account invocation
    InvocationType: 'Event', // async fire-and-forget
    // Imitate a minimal API Gateway event: body must be a string
    Payload: Buffer.from(
      JSON.stringify({ body: JSON.stringify(payload) })
    ),
  })

  const res = await client.send(command)
  // For 'Event', StatusCode is typically 202 when accepted
  if (res.StatusCode && res.StatusCode >= 400) {
    throw new Error(`Cross-account email invoke failed with status ${res.StatusCode}`)
  }
}
