import { organizationsTableName } from '@marketplace/constants'
import { Organization } from '@marketplace/types'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { update } from '../../helpers/dynamo-helpers/update'

export const updateOrganizationHandler = async (event: APIGatewayProxyEvent) => {
  try {
    const partialOrganization = JSON.parse(event.body ?? '{}')
    if (!partialOrganization.id) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing organization ID'
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    const blacklistedFields: (keyof Organization)[] = [
      'created_at',
      'stripe_subscription_ids',
      'stripe_account_id',
      'stripe_bank_account_id',
      'in_good_standing_until',
      'onboarding_url',
      'onboarding_status',
      'onboarding_completed_at',
      'missing_requirements',
      'charges_enabled',
      'payouts_enabled'
    ]
    for (const field of blacklistedFields) {
      if (field in partialOrganization) {
        delete partialOrganization[field]
      }
    }
    const org = await update<Organization>({
      tableName: organizationsTableName!,
      key: { id: partialOrganization.id },
      updates: {
        ...partialOrganization,
        updated_at: new Date().toISOString()
      },
      returnUpdated: true
    })
    return {
      statusCode: 200,
      body: JSON.stringify(org),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } catch (error) {
    console.log(error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: (error as Error).message || 'Failed to update organization'
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
}