import {
  InvokeCommand, LambdaClient
} from '@aws-sdk/client-lambda'
import { fromTemporaryCredentials } from '@aws-sdk/credential-providers'
import { SendSMSParams } from '@marketplace/types/internal/sms'
/*
Use this function to wire up your SMS sending logic.

I'm using a lambda set up in a different aws account since i already had that system built out and production approved
*/
// Read static config once at module load for Lambda container reuse
const targetArn = process.env.SMS_LAMBDA_ARN
const targetRegion = process.env.EMAIL_AWS_REGION
const assumeRoleArn = process.env.EMAIL_ASSUME_ROLE_ARN

// Cache credentials/client across warm invocations (no invalidation here by design)
let cachedClient: LambdaClient | null = null

async function getLambdaClient(): Promise<LambdaClient> {
  if (cachedClient) return cachedClient

  if (!targetArn) throw new Error('SMS_LAMBDA_ARN is not set')
  if (!targetRegion) throw new Error('EMAIL_AWS_REGION is not set')

  if (assumeRoleArn) {
    cachedClient = new LambdaClient({
      region: targetRegion,
      credentials: fromTemporaryCredentials({
        clientConfig: { region: targetRegion },
        params: {
          RoleArn: assumeRoleArn,
          RoleSessionName: 'send-sms-cross-account',
        },
      }),
    })
  } else {
    cachedClient = new LambdaClient({ region: targetRegion })
  }
  return cachedClient
}
let smsClient: LambdaClient | undefined = undefined
export async function sendSMS(params: SendSMSParams): Promise<void> {
  // Cross-account invoke.
  // - If SMS_ASSUME_ROLE_ARN is set, assume that role in the target account first.
  // - Otherwise, invoke directly (requires resource policy on target Lambda to allow current principal).
  if (!smsClient) {
    smsClient = await getLambdaClient()
  }
  if (!smsClient) throw new Error('Failed to get SMS Lambda client')

  const payload = {
    detail: {
      phoneNumber: params.phoneNumber,
      message: params.message,
      senderId: params.senderId
    }
  }

  const command = new InvokeCommand({
    FunctionName: targetArn!, // full ARN for cross-account invocation
    InvocationType: 'Event', // async fire-and-forget
    Payload: Buffer.from(
      JSON.stringify({ payload })
    ),
  })

  const res = await smsClient.send(command)
  // For 'Event', StatusCode is typically 202 when accepted
  if (res.StatusCode && res.StatusCode >= 400) {
    throw new Error(`Cross-account email invoke failed with status ${res.StatusCode}`)
  }
}
