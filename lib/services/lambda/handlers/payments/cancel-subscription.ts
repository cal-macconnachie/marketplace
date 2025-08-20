import { APIGatewayProxyEvent } from 'aws-lambda'
import { get } from '../../helpers/dynamo-helpers/get'
import { User } from '../users'
import { Organization } from '../organizations'
import { getStripeClient } from '../../helpers/stripe/stripe-client'
import { update } from '../../helpers/dynamo-helpers/update'

export async function cancelSubscription(event: APIGatewayProxyEvent) {
  try {
    const { body } = event
    const {
      user_id: userId,
      subscription_id: subscriptionId
    } : {
      user_id: string,
      subscription_id: string
    } = JSON.parse(body ?? '{}')
    // ensure this user is an organization admin for the subscription
    const user = await get<User>({
      tableName: process.env.USERS_TABLE!,
      key: { id: userId }
    })
    if (!user || !user.is_organization_admin) {
      throw new Error(`User is not an organization admin: ${userId}`)
    }
    const organization = await get<Organization>({
      tableName: process.env.ORGANIZATIONS_TABLE!,
      key: { id: user.organization_id }
    })
    if (!organization) {
      throw new Error(`Organization not found: ${user.organization_id}`)
    }
    if (organization.stripe_subscription_id != subscriptionId) {
      throw new Error(`Subscription not found: ${subscriptionId}`)
    }
    const stripe = getStripeClient()
    await stripe.subscriptions.cancel(subscriptionId)
    await update<Organization>({
      tableName: process.env.ORGANIZATIONS_TABLE!,
      key: { id: user.organization_id },
      updates: {
        stripe_subscription_id: ''
      }
    })
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      }
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: (error as Error).message }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      }
    }
  }
}