import { organizationsTableName } from '@marketplace/constants'
import { Organization } from '@marketplace/types'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { update } from '../../helpers/dynamo-helpers/update'
import { getOrganizationById } from '../../helpers/organizations/get-organization-by-id'
import { getStripeClient } from '../../helpers/stripe/stripe-client'

export const refreshConnectUrl = async (event: APIGatewayProxyEvent) => {
  const stripe = getStripeClient()
  try {
    const {
      organization_id, refresh_url, return_url 
    } = JSON.parse(event.body || '{}')
    const org = await getOrganizationById(organization_id)
    if (org == null) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Organization not found' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    if (org.onboarding_status !== 'in_progress' && org.onboarding_status !== 'requires_action') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Onboarding not in progress' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    if (org.stripe_account_id == null) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Stripe account not found' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    const account = await stripe.accounts.retrieve(org.stripe_account_id)
    if (!account) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Stripe account not found' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url,
      return_url,
      type: 'account_onboarding'
    })
    await update<Organization>({
      tableName: organizationsTableName!,
      key: { id: organization_id },
      updates: {
        onboarding_url: accountLink.url
      }
    })
    return {
      statusCode: 200,
      body: JSON.stringify({ url: accountLink.url }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } catch (error) {
    console.log('Error refreshing connect URL:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: (error as Error).message || 'Failed to refresh connect URL' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
}
