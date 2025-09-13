import { Organization } from '../../handlers/organizations'
import { getOrganizationById } from '../organizations/get-organization-by-id'
const organizationsCache: { [key: string]: Organization | null } = {}
export const calculatePlatformFee = async ({
  amount,
  organizationId
}: {
  amount: number
  organizationId?: string
}): Promise<number> => {
  // Platform fee logic: 6% + $0.30
  let percent = 0.06
  let fixedFee = 30 // $0.30 in cents 
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

export const calculateConnectedAccountAmount = (
  totalAmount: number,
  platformFeeAmount: number
): number => {
  return totalAmount - platformFeeAmount
}