import { EventBridgeEvent } from 'aws-lambda'
import { collectReceiptEmailData } from '../../helpers/emails/collect-receipt-data'
import { sendEmail } from '../../helpers/emails/send-email'
import { compileTemplate } from '../../helpers/handlebars/compile-template'

export const productsPurchased = async (event: EventBridgeEvent<'products-purchased',{
  userId: string
  organizationId: string
  paymentMethodId: string
  purchases: { user_id: string; id: string }[]
  products: { group_id: string; id: string; quantity: number }[]
}>) => {
  const ctx = await collectReceiptEmailData(event.detail)

  const html = compileTemplate({
    templatePath: 'receipt.hbs',
    context: ctx
  })

  // 3) Prepare email fields
  const subject = `Your Receipt • ${ctx.summary.total_formatted}`
  const to = ctx.customer_email || ''
  const from = 'marketplace-no-reply@csm.codes'

  if (!to) {
    // If we don't have a customer email, skip sending but do not throw
    console.warn('Customer email missing; skipping receipt email send')
    return
  }

  // 4) Send the email via stubbed helper
  await sendEmail({
    to,
    from,
    subject,
    body: html
  })
}
