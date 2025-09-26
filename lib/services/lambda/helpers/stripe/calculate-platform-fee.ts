import { Organization } from '../../handlers/organizations'
import { getOrganizationById } from '../organizations/get-organization-by-id'
const organizationsCache: { [key: string]: Organization | null } = {}
export const calculatePlatformFee = async ({
  amount,
  organizationId,
  subscription
}: {
  amount: number
  organizationId?: string
  subscription?: boolean
}): Promise<number> => {
  // Platform fee logic: 6% + $0.30
  let percent = 0.06
  let fixedFee = 30 // $0.30 in cents 
  if (subscription) {
    // Subscription fees can only be percentage-based so we will be returning a whole number percent here
    if (organizationId) {
      const org = organizationsCache[organizationId] ? organizationsCache[organizationId] : await getOrganizationById(organizationId)
      if (org && org.subscription_platform_fee_percent) {
        percent = org.subscription_platform_fee_percent / 100
      }
    }
    // assume stripes international 3.9% + 0.30
    // we need to ensure we're charging more than that
    const stripeAmount = (amount * 0.039 + 30)
    let ourAmount = amount * percent
    while (ourAmount < stripeAmount + 30) {
      percent += 0.005
      ourAmount = amount * percent
    }
    return Number((percent * 100).toFixed(2))
  } else {
    if (!amount) {
      throw new Error('Amount is required for one-time purchases')
    }
    if (organizationId) {
      const org = organizationsCache[organizationId] ? organizationsCache[organizationId] : await getOrganizationById(organizationId)
      if (org && org.platform_fee_percent) {
        percent = org.platform_fee_percent / 100
      }
      if (org && org.platform_fee_fixed) {
        fixedFee = org.platform_fee_fixed
      }
    }
    const percentageFee = Math.round(amount * percent)
    return percentageFee + fixedFee
  }
}

export const calculateConnectedAccountAmount = (
  totalAmount: number,
  platformFeeAmount: number
): number => {
  return totalAmount - platformFeeAmount
}