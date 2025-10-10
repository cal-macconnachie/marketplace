import { purchaseCartsTableName } from '@marketplace/constants'
import { Cart } from '@marketplace/types'
import { get } from '../dynamo-helpers/get'

export const getCart = async ({
  userId,
  cartId
}: {
  userId: string
  cartId: string
}): Promise<Cart | null> => {
  const cart = await get<Cart>({
    tableName: purchaseCartsTableName,
    key: {
      user_id: userId,
      id: cartId
    }
  })
  return cart
}
