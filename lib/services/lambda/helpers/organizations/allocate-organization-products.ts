import { Organization } from "../../handlers/organizations"
import { PurchasedProduct } from "../../handlers/products"
import { User } from "../../handlers/users"
import { queryAll } from '../dynamo-helpers/query'
import { update } from "../dynamo-helpers/update"

export const allocateOrganizationProducts = async (organization: Organization) => {
  const purchasedProducts = await queryAll<PurchasedProduct>({
    tableName: process.env.PURCHASED_PRODUCTS_TABLE!,
    keyConditionExpression: 'organization_id = :orgId',
    expressionAttributeValues: {
      ':orgId': organization.id
    }
  })
  if (purchasedProducts && purchasedProducts.length > 0) {
    // Update users with their purchased products
    const userPurchasedProducts = purchasedProducts.reduce((acc: Record<string, PurchasedProduct[]>, product) => {
      const userId = product.user_id
      if (userId == null) return acc
      acc[userId] = acc[userId] ?? []
      acc[userId].push(product)
      return acc
    }, {})

    for (const userId in userPurchasedProducts) {
      const products = userPurchasedProducts[userId]
      await update<User>({
        tableName: process.env.USERS_TABLE!,
        key: { id: userId },
        updates: {
          products
        }
      })
    }
  }
}
