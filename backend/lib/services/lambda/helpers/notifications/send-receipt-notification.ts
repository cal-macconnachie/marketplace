import { usersTableName } from '@marketplace/constants'
import { User } from '@marketplace/types'
import { getCart } from '../carts/get-cart'
import { get } from '../dynamo-helpers/get'
import { collectReceiptEmailData } from '../emails/collect-receipt-data'
import { sendReceiptEmail } from '../emails/send-receipt-email'
import { getOrganizationUsers } from '../organizations/get-organization-users'
import { sendReceiptSMS } from '../sms/send-receipt-sms'
import { createNotification } from './internal-notifications/create-notification'

export const sendReceiptNotification = async ({
  userId,
  cartId
}: {
  userId: string
  cartId: string
}) => {
  const user = await get<User>({
    tableName: usersTableName,
    key: { id: userId }
  })
  if (!user) {
    throw new Error(`User not found: ${userId}`)
  }
  if (user.notification_opt_out?.receipts) {
    return
  }

  // Fetch cart once to avoid duplicate calls
  const cart = await getCart({
    userId, cartId 
  })
  if (!cart) {
    throw new Error(`Cart not found: ${cartId}`)
  }

  // Collect receipt data once and share between email and SMS
  const ctx = await collectReceiptEmailData({
    user,
    cart
  })

  if (user.email && user.notifications?.email) {
    console.log('Sending receipt email to', user.email)
    await sendReceiptEmail({ ctx })
  }
  if (user.phone_number && user.notifications?.sms) {
    console.log('Sending receipt SMS to', user.phone_number)
    await sendReceiptSMS({ ctx })
  }

  // Create in-app notification for buyer
  await createNotification({
    user_id: userId,
    type: 'receipt',
    title: 'Purchase Complete',
    message: `Your purchase of ${ctx.line_items.length} item(s) for ${ctx.summary.total_formatted} is complete.`,
    metadata: {
      order_id: cartId,
      summary: ctx.summary, // Convert to cents
      currency: ctx.currency
    }
  })

  // Create in-app notifications for all seller organization admins
  const sellerOrgIds = Array.from(new Set(
    (ctx.sellers ?? []).map(seller => seller.id).filter(Boolean)
  ))

  for (const orgId of sellerOrgIds) {
    const orgUsers = await getOrganizationUsers({ orgId })
    const adminUsers = orgUsers.filter(u => u.is_organization_admin)

    // Find items sold by this organization
    const orgItems = ctx.line_items.filter(item => item.seller_id === orgId)
    const orgTotal = ctx.seller_groups?.find(g => g.seller_id === orgId)?.total_formatted

    // Create notification for each admin
    await Promise.all(
      adminUsers.map(admin =>
        createNotification({
          user_id: admin.id,
          type: 'sale',
          title: 'New Sale',
          message: `New order from ${ctx.customer_name}: ${orgItems.length} ${orgItems.length === 1 ? 'item' : 'items'} totaling ${orgTotal || 'N/A'}.`,
          metadata: {
            order_id: cartId,
            customer_id: userId,
            customer_name: ctx.customer_name,
            summary: ctx.summary,
            currency: ctx.currency,
            shipping_address: cart.shipping_address
          }
        })
      )
    )
  }
}
