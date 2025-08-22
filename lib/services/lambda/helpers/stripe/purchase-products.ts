import { Organization } from "../../handlers/organizations"
import { PaymentMethod } from "../../handlers/payment-methods"
import { Product } from "../../handlers/products"
import { User } from "../../handlers/users"
import { get } from "../dynamo-helpers/get"
import { manageSubscription } from "./manage-subscription"
import { createOneTimePayment } from "./one-time-payment"

export const purchaseProducts = async ({
  userId,
  paymentMethodId,
  productKeys,
  promoCode,
  couponId
}: {
  userId: string,
  paymentMethodId?: string,
  productKeys: ({
    id: string
    group_id: string
  })[]
  promoCode?: string
  couponId?: string
}) => {
  const uniqueProductKeys = productKeys.reduce((acc: string[], product) => {
    const key = `${product.id}:${product.group_id}`
    if (!acc.includes(key)) {
      acc.push(key)
    }
    return acc
  }, []).map((key) => {
    const [
      id,
      group_id
    ] = key.split(":")
    return {
      id, group_id 
    }
  })
  let [
    user,
    paymentMethod,
    products
  ]: [User | undefined, PaymentMethod | undefined, (Product | undefined)[]
] = await Promise.all([
  get<User>({
    tableName: process.env.USERS_TABLE!,
    key: { id: userId }
  }),
  paymentMethodId ? get<PaymentMethod>({
    tableName: process.env.PAYMENT_METHODS_TABLE!,
    key: {
      user_id: userId,
      id: paymentMethodId
    }
  }) : Promise.resolve(undefined),
  await Promise.all(uniqueProductKeys.map(async (key) => {
    return get<Product>({
      tableName: process.env.PRODUCTS_TABLE!,
      key
    })
  }))
])
  if (user == null) {
    throw new Error(`User not found: ${userId}`)
  }
  // only org admins can purchase
  if (!user.is_organization_admin) {
    throw new Error(`User is not an organization admin: ${userId}`)
  }
  if (products.length === 0 || products.filter(Boolean).length === 0 || products.filter(Boolean).length !== uniqueProductKeys.length) {
    throw new Error(`Some Products not found: ${JSON.stringify(uniqueProductKeys)}`)
  }
  const organization = await get<Organization>({
    tableName: process.env.ORGANIZATIONS_TABLE!,
    key: { id: user.organization_id }
  })

  if (organization == null) {
    throw new Error(`Organization not found: ${user.organization_id}`)
  }
  if (paymentMethod == null) {
    // user may be attempting to make purchase on behalf of the organization
    // ensure org has default payment method
    // if org has default payment method get that payment methods user and replace current user with it
    if (organization.default_payment_method == null) {
      throw new Error(`Payment method not found for organization: ${user.organization_id}`)
    }
    const currentUserHasOrgPaymentMethod = organization.default_payment_method.user_id === user.id
    ;([
      paymentMethod,
      user
    ] = await Promise.all([
      get<PaymentMethod>({
        tableName: process.env.PAYMENT_METHODS_TABLE!,
        key: {
          user_id: organization.default_payment_method.user_id,
          id: organization.default_payment_method.id
        }
      }),
      currentUserHasOrgPaymentMethod ? Promise.resolve(user) : get<User>({
        tableName: process.env.USERS_TABLE!,
        key: { id: organization.default_payment_method.user_id }
      })
    ])
    )
    if (user == null) {
      throw new Error(`User not found for payment method: ${organization.default_payment_method.user_id}`)
    }
  }
  if (paymentMethod == null) {
    throw new Error(`Payment method not found for organization: ${user.organization_id}`)
  }
  const productsHash = products.filter(Boolean).reduce((acc: { [hash: string]: Product }, product) => {
    if (product) {
      acc[`${product.group_id}:${product.id}`] = product
    }
    return acc
  }, {})
  const productsToPurchase = productKeys.map((key) => productsHash[`${key.group_id}:${key.id}`]).filter(Boolean)
  const oneTimeProduct = productsToPurchase.filter((prod) => !Boolean(prod.default_price_data.recurring))
  const subscriptionProducts = productsToPurchase.filter((prod) => Boolean(prod.default_price_data.recurring))
  for (const product of oneTimeProduct) {
    try {
      await createOneTimePayment({
        promotionCode: promoCode,
        couponId: couponId,
        paymentMethodId: paymentMethod.id,
        product,
        user,
        organization
      })
    } catch (error) {
      console.error(`Error creating one-time payment for product ${product.id}:`, error)
    }
  }
  try {
    await manageSubscription({
      promotionCode: promoCode,
      couponId: couponId,
      paymentMethodId: paymentMethod.id,
      products: subscriptionProducts,
      user,
      organization,
      remove: false
    })
  } catch (error) {
    console.error(`Error managing subscription for user ${user.id}:`, error)
  }
}