export const calculatePlatformFee = async (
  amount: number
): Promise<number> => {
  // Platform fee logic: 3% + $0.30
  const percentageFee = Math.round(amount * 0.03)
  const fixedFee = 30 // $0.30 in cents
  return Promise.resolve(percentageFee + fixedFee)
}

export const calculateConnectedAccountAmount = (
  totalAmount: number,
  platformFeeAmount: number
): number => {
  return totalAmount - platformFeeAmount
}