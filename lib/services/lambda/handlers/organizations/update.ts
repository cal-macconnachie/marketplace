import { APIGatewayProxyEvent } from 'aws-lambda'
import { Organization } from '../organizations'
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
      'purchased_products',
      'stripe_subscription_id',
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
      tableName: process.env.ORGANIZATIONS_TABLE!,
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