import { Product } from '../../handlers/products'
import { update } from '../dynamo-helpers/update'
import { getStripeClient } from './stripe-client'

export const getProductPriceId = async (product: Partial<Product>): Promise<string> => {
  if (product.price_id) return product.price_id
  if (product.id == null) throw new Error('Product ID is required to fetch price')
  const stripe = getStripeClient()
  const stripeProduct = await stripe.products.retrieve(product.id)
  const price = stripeProduct.default_price
  if (!price) {
    throw new Error('Product does not have a default price')
  }
  const finalPrice = typeof price === 'string' ? price : price.id
  if (product.group_id) {
    await update<Product>({
      tableName: process.env.PRODUCTS_TABLE!,
      key: {
        group_id: product.group_id,
        id: product.id
      },
      updates: { price_id: finalPrice }
    })
  }
  return finalPrice
}
