import { Purchase } from '../handlers/purchases'
import { create } from './dynamo-helpers/create'

export async function addPurchase(purchase: Purchase) {
  await create<Purchase>({
    tableName: process.env.PURCHASES_TABLE!,
    key: {
      user_id: purchase.user_id,
      id: purchase.id
    },
    record: purchase
  })
}