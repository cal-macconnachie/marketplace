import { EventBridgeEvent } from 'aws-lambda'
import { sendReceiptNotification } from '../../helpers/notifications/send-receipt-notification'

export const productsPurchased = async (event: EventBridgeEvent<'products-purchased',{
  userId: string
  cartId: string
}>) => {
  try {
    console.log('Sending receipt notification', event)
    await sendReceiptNotification({
      userId: event.detail.userId,
      cartId: event.detail.cartId
    })
  } catch (error) {
    console.error('Error sending receipt email:', error)
    throw error
  }
}
