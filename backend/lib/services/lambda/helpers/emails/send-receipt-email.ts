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
    console.log('Skipping receipt email to', ctx.customer_email)
    return
  }

  const html = compileTemplate({
    templatePath: 'receipt.hbs',
    context: ctx
  })
  console.log('Compiled receipt email HTML')

  // 3) Prepare email fields
  const subject = `Your Receipt • ${ctx.summary.total_formatted}`
  const to = ctx.customer_email || ''
  const from = `${ctx.header_brand ?? 'Marketplace'} Receipt <no-reply@${domain}>`

  // 4) Send the email via stubbed helper
  await sendEmail({
    to,
    from,
    subject,
    body: html
  })
}