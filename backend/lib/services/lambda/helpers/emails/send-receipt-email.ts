import {
  domain, emailStringsToIgnore
} from '@marketplace/constants'
import { ReceiptEmailContext } from '@marketplace/types'
import { compileTemplate } from '../handlebars/compile-template'
import { sendEmail } from './send-email'

export const sendReceiptEmail = async ({
  ctx
}: {
  ctx: ReceiptEmailContext
}) => {
  if (!ctx.customer_email || emailStringsToIgnore.some(str => ctx.customer_email?.includes(str))) {
    return
  }

  const html = compileTemplate({
    templatePath: 'receipt.hbs',
    context: ctx
  })

  // 3) Prepare email fields
  const subject = `Your Receipt • ${ctx.summary.total_formatted}`
  const to = ctx.customer_email || ''
  const from = `${ctx.header_brand ?? 'Marketplace'} Receipt <no-reply@${domain}>`

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