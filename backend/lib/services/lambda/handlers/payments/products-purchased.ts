import { EventBridgeEvent } from 'aws-lambda'
import { sendReceiptEmail } from '../../helpers/emails/send-receipt-email'

export const productsPurchased = async (event: EventBridgeEvent<'products-purchased',{
  userId: string
  cartId: string
}>) => {
  try {
    console.log('Sending receipt email...', event)
    await sendReceiptEmail({
      userId: event.detail.userId,
      cartId: event.detail.cartId
    })
  } catch (error) {
    console.error('Error sending receipt email:', error)
    throw error
  }
}
