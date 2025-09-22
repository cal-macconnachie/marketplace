import { EventBridgeEvent } from 'aws-lambda'
import { sendReceiptEmail } from '../../helpers/emails/send-receipt-email'

export const productsPurchased = async (event: EventBridgeEvent<'products-purchased',{
  userId: string
  paymentMethodId: string
  purchases: { user_id: string; id: string }[]
  products: { group_id: string; id: string; quantity: number }[]
}>) => {
  await sendReceiptEmail({
    userId: event.detail.userId,
    paymentMethodId: event.detail.paymentMethodId,
    purchases: event.detail.purchases,
    products: event.detail.products
  })
}
