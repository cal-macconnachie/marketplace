import {
  purchasedProductsTableName, usersTableName
} from '@marketplace/constants'
import {
  Organization, PurchasedProduct, User
} from '@marketplace/types'
import { queryAll } from '../dynamo-helpers/query'
import { update } from "../dynamo-helpers/update"

export const allocateOrganizationProducts = async (organization: Organization) => {
  const purchasedProducts = await queryAll<PurchasedProduct>({
    tableName: purchasedProductsTableName!,
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
        tableName: usersTableName!,
        key: { id: userId },
        updates: {
          products
        }
      })
    }
  }
}
