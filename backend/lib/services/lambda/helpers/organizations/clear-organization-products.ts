import { PurchasedProduct } from "../../handlers/products"
import { User } from "../../handlers/users"
import { get } from "../dynamo-helpers/get"
import { update } from "../dynamo-helpers/update"

export const clearOrganizationProducts = async (purchasedProducts: (PurchasedProduct)[]) => {
  for (const product of purchasedProducts) {
    const user = await get<User>({
      tableName: process.env.USERS_TABLE!,
      key: { id: product.user_id }
    })
    if (user) {
      await update<User>({
        tableName: process.env.USERS_TABLE!,
        key: { id: user.id },
        updates: {
          products: (user.products ?? []).filter(p => p.id !== product.id)
        }
      })
    }
  }
}
