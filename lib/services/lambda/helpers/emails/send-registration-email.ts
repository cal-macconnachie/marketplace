import { compileTemplate } from '../handlebars/compile-template'
import { sendEmail } from './send-email'

export async function sendRegistrationEmail({
  to,
  code,
  brand,
  from
}: {
  to: string
  code: string
  brand?: string
  from?: string
}) {
  const context = {
    brand: brand ?? 'Marketplace',
    code,
    expires_minutes: 15
  }

  const html = compileTemplate({
    templatePath: 'registration.hbs',
    context
  })

  const subject = `${context.brand}: Your registration code`
  const fromAddr = from ?? `${context.brand} Registration <no-reply@marketplace.csm.codes>`

  await sendEmail({
    to,
    from: fromAddr,
    subject,
    body: html
  })
}
