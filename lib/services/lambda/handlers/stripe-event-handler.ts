import { EventBridgeEvent } from 'aws-lambda'
import Stripe from 'stripe'
import { update } from '../helpers/dynamo-helpers/update'
import { Organization } from './organizations'
import { query } from '../helpers/dynamo-helpers/query'

export const stripeEventHandler = async (event: EventBridgeEvent<'Stripe Event', Stripe.Event>) => {
  const type = event.detail.type
  // Handle connected account events only (platform events handled by stripe-platform-event-handler)
  switch (type) {
    case 'account.updated': {
      const account = event.detail.data.object as Stripe.Account
      
      // Find user by stripe_account_id using scan (until GSI is deployed)
      const scanResult = await query<Organization>({
        tableName: process.env.ORGANIZATIONS_TABLE!,
        indexName: 'stripe_account_id-index',
        keyConditionExpression: 'stripe_account_id = :accountId',
        expressionAttributeValues: {
          ':accountId': account.id
        }
      })
      
      if (!scanResult.items || scanResult.items.length === 0) {
        console.error('No user found for stripe_account_id:', account.id)
        return
      }
      
      const org = scanResult.items[0]
      const isFullyOnboarded = account.charges_enabled && 
                               account.payouts_enabled && 
                               (!account.requirements?.currently_due || account.requirements.currently_due.length === 0)
      
      // Update user with latest account status
      await update<Organization>({
        tableName: process.env.ORGANIZATIONS_TABLE!,
        key: { id: org.id },
        updates: {
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
          missing_requirements: [
            ...(account.requirements?.currently_due || []),
            ...(account.requirements?.eventually_due || [])
          ],
          // Clear onboarding URL once fully onboarded
          ...(isFullyOnboarded ? {
            onboarding_url: '',
            onboarding_completed_at: new Date().toISOString(),
            onboarding_status: 'completed'
          } : {
            onboarding_status: (account.requirements?.currently_due?.length ?? 0) > 0 ? 'requires_action' : 'in_progress'
          })
        }
      })

      break
    }
    default: {
      console.log(`Unhandled event type: ${type}`)
      break
    }
  }
}