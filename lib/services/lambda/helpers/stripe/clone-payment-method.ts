import { getStripeClient } from './stripe-client'
import { User } from '../../handlers/users'
import { cloneCustomerToConnectedAccount } from './clone-customer'

export const clonePaymentMethodToConnectedAccount = async ({
  paymentMethodId,
  user,
  connectedAccountId
}: {
  paymentMethodId: string
  user: User
  connectedAccountId: string
}): Promise<{ paymentMethodId: string; customerId: string }> => {
  const stripe = getStripeClient()
  
  try {
    // First clone the customer to the connected account
    const connectedCustomerId = await cloneCustomerToConnectedAccount({
      user,
      connectedAccountId
    })
    
    // Then clone the payment method
    const clonedPaymentMethod = await stripe.paymentMethods.create({
      payment_method: paymentMethodId
    }, {
      stripeAccount: connectedAccountId
    })
    
    // Attach to cloned customer on connected account
    if (clonedPaymentMethod.id) {
      await stripe.paymentMethods.attach(clonedPaymentMethod.id, {
        customer: connectedCustomerId
      }, {
        stripeAccount: connectedAccountId
      })
    }
    
    return {
      paymentMethodId: clonedPaymentMethod.id,
      customerId: connectedCustomerId
    }
  } catch (cloneError) {
    console.warn('Direct payment method clone failed, trying SetupIntent approach:', cloneError)
    
    // Fallback: Use SetupIntent to clone and confirm
    try {
      // First clone the customer for fallback approach too
      const connectedCustomerId = await cloneCustomerToConnectedAccount({
        user,
        connectedAccountId
      })
      
      const setupIntent = await stripe.setupIntents.create({
        customer: connectedCustomerId,
        payment_method: paymentMethodId,
        confirm: true,
        usage: 'off_session',
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never'
        }
      }, {
        stripeAccount: connectedAccountId
      })
      
      if (setupIntent.status !== 'succeeded') {
        throw new Error(`SetupIntent failed with status: ${setupIntent.status}`)
      }
      
      if (!setupIntent.payment_method || typeof setupIntent.payment_method !== 'string') {
        throw new Error('SetupIntent did not return a valid payment method ID')
      }
      
      return {
        paymentMethodId: setupIntent.payment_method,
        customerId: connectedCustomerId
      }
    } catch (setupError) {
      throw new Error(`Failed to clone payment method to connected account: ${setupError instanceof Error ? setupError.message : 'Unknown error'}`)
    }
  }
}