import { compileTemplate } from '../handlebars/compile-template'
import { collectReceiptEmailData } from './collect-receipt-data'
import { sendEmail } from './send-email'

export const sendReceiptEmail = async ({
  userId,
  paymentMethodId,
  purchases,
  products
}: {
  userId: string
  paymentMethodId: string
  purchases: { user_id: string; id: string }[]
  products: { group_id: string; id: string; quantity: number }[]
}) => {
  const ctx = await collectReceiptEmailData({
    userId,
    paymentMethodId,
    purchases,
    products
  })
  if (ctx.opt_out) {
    return
  }

  const html = compileTemplate({
    templatePath: 'receipt.hbs',
    context: ctx
  })

  // 3) Prepare email fields
  const subject = `Your Receipt • ${ctx.summary.total_formatted}`
  const to = ctx.customer_email || ''
  const from = `${ctx.header_brand ?? 'Marketplace'} Receipt <no-reply@marketplace.csm.codes>`

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