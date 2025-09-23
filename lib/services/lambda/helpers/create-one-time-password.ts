import { create } from './dynamo-helpers/create'

export interface OneTimePassword {
  email: string
  type: string
  one_time_password: string
  expires_at: string
  created_at: string
}

export const createOneTimePassword = async ({
  email,
  type
}: {
  email: string
  type: string
}) => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  await create<OneTimePassword>({
    tableName: process.env.ONE_TIME_CODES_TABLE!,
    key: {
      email,
      type
    },
    record: {
      email,
      type,
      one_time_password: otp,
      expires_at: (new Date(Date.now() + 15 * 60 * 1000)).toISOString(), // 15 minutes from now
      created_at: (new Date()).toISOString()
    }
  })
  return otp
}
