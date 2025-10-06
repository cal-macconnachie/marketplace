import type { OneTimePassword } from '@marketplace/types'
import { oneTimeCodesTableName } from '@marketplace/constants'
import { create } from './dynamo-helpers/create'

export const createOneTimePassword = async ({
  email,
  type
}: {
  email: string
  type: string
}) => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  await create<OneTimePassword>({
    tableName: oneTimeCodesTableName!,
    key: {
      email,
      type
    },
    record: {
      email,
      type,
      one_time_password: otp,
      expires_at: Math.floor((Date.now() + 15 * 60 * 1000) / 1000), // 15 minutes from now
      created_at: (new Date()).toISOString()
    }
  })
  return otp
}
