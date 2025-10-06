import { usersTableName } from '@marketplace/constants'
import {
  PurchasedProduct, User
} from '@marketplace/types'
import { get } from "../dynamo-helpers/get"
import { update } from "../dynamo-helpers/update"

export const clearOrganizationProducts = async (purchasedProducts: (PurchasedProduct)[]) => {
  for (const product of purchasedProducts) {
    const user = await get<User>({
      tableName: usersTableName!,
      key: { id: product.user_id }
    })
    if (user) {
      await update<User>({
        tableName: usersTableName!,
        key: { id: user.id },
        updates: {
          products: (user.products ?? []).filter(p => p.id !== product.id)
        }
      })
    }
  }
}
