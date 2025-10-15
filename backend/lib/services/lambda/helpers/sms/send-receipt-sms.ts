import {
  ReceiptEmailContext
} from '@marketplace/types'
import { sendSMS } from './send-sms'

export const sendReceiptSMS = async ({
  ctx
}: {
  ctx: ReceiptEmailContext
}) => {
  if (!ctx.customer_phone) {
    return
  }

  // Get unique seller names
  const sellerNames = Array.from(
    new Set(ctx.line_items?.map(item => item.seller_name).filter(Boolean))
  )

  // Build seller text
  let sellerText: string
  if (sellerNames.length === 0) {
    sellerText = 'your purchase'
  } else if (sellerNames.length === 1) {
    sellerText = sellerNames[0]!
  } else if (sellerNames.length === 2) {
    sellerText = `${sellerNames[0]} and ${sellerNames[1]}`
  } else {
    sellerText = `${sellerNames.slice(0, -1).join(', ')}, and ${sellerNames[sellerNames.length - 1]}`
  }

  const message = `Thank you for your ${ctx.line_items?.length > 1 ? 'purchases' : 'purchase'} from ${sellerText}!\nTotal: ${ctx.summary.total_formatted}\n\nView receipt: ${ctx.receipt_url} -`

  await sendSMS({
    phoneNumber: ctx.customer_phone,
    message,
    senderId: process.env.MARKETPLACE_BRAND || 'Marketplace'
  })
}