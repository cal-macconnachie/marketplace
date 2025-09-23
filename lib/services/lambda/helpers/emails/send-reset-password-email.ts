import { compileTemplate } from '../handlebars/compile-template'
import { sendEmail } from './send-email'

export async function sendResetPasswordEmail({
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
    templatePath: 'reset-password.hbs',
    context
  })

  const subject = `${context.brand}: Your password reset code`
  const fromAddr = from ?? `${context.brand} Password Reset <no-reply@marketplace.csm.codes>`

  await sendEmail({
    to,
    from: fromAddr,
    subject,
    body: html
  })
}

