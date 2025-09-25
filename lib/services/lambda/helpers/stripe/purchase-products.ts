import { Organization } from "../../handlers/organizations"
import { PaymentMethod } from "../../handlers/payment-methods"
import {
  Product, PurchasedProduct 
} from "../../handlers/products"
import { Purchase } from '../../handlers/purchases'
import { User } from "../../handlers/users"
import { get } from "../dynamo-helpers/get"
import { update } from '../dynamo-helpers/update'
import { createDestinationCharge } from './create-destination-charge'
import { manageSubscription } from "./manage-subscription"
import { createOneTimePurchase } from "./one-time-purchase"
import { createPurchaseCart } from '../create-purchase-cart'

export const purchaseProducts = async ({
  userId,
  paymentMethodId,
  productKeys,
  promoCode,
  couponId,
  taxCode,
  ipAddress
}: {
  userId: string,
  paymentMethodId?: string,
  productKeys: ({
    id: string
    group_id: string
  })[]
  promoCode?: string
  couponId?: string
  taxCode?: string
  ipAddress?: string
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
  // Create a cart for this purchase session
  const cartItems = productsToPurchase.map(product => ({
    product_id: product.id,
    group_id: product.group_id
    // processed is initially undefined until webhooks process the item
  }))

  const cart = await createPurchaseCart({
    userId,
    items: cartItems,
    paymentMethodId: paymentMethod.id,
    purchaseIds: []
  })
  const cartId = cart.id

  const purchaseDataList: Purchase[] = []
  const purchasedProducts: PurchasedProduct[] = []
  for (const product of oneTimeProduct) {
    try {
      const paymentResponse = await createOneTimePurchase({
        promotionCode: promoCode,
        couponId: couponId,
        paymentMethodId: paymentMethod.id,
        product,
        user,
        organization,
        taxCode,
        ipAddress
      })
      if (paymentResponse.purchaseData) {
        purchaseDataList.push(paymentResponse.purchaseData)
      }
      if (paymentResponse.purchasedProduct) {
        purchasedProducts.push(paymentResponse.purchasedProduct)
      }
    } catch (error) {
      console.error(`Error creating one-time payment for product ${product.id}:`, error)
    }
  }
  try {
    // summarize purchase data by connected_account_id and currency to create individual destination charges for each group
    const groupedPurchaseData = purchaseDataList.reduce((acc, purchaseData) => {
      const key = `${purchaseData.connected_account_id}:${purchaseData.currency}`
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(purchaseData)
      return acc
    }, {} as Record<string, Purchase[]>)

    // Create destination charges for each group
    for (const [
      key,
      group
    ] of Object.entries(groupedPurchaseData)) {
      try {
        const destinationAccountId = group[0].connected_account_id
        if (destinationAccountId == null) throw new Error(`Destination account ID not found for group ${key}`)

        // Get product IDs for this group to pass in metadata
        const productIds = group.map(p => p.product_id)

        await createDestinationCharge({
          amount: group.reduce((sum, purchaseData) => sum + purchaseData.amount, 0),
          currency: group[0].currency,
          paymentMethodId: paymentMethod.id,
          user,
          destinationAccountId,
          cartId, // Pass cart ID for tracking
          productIds // Pass product IDs for metadata
        })

        // Update organization with purchased products (but don't create purchases yet - webhook will do that)
        const purchasedProductsForGroup = purchasedProducts.filter((pp) => group.some((p) => p.id === pp.purchase_id))
        if (purchasedProductsForGroup.length > 0) {
          await update<Organization>({
            tableName: process.env.ORGANIZATIONS_TABLE!,
            key: { id: organization.id },
            updates: {
              purchased_products: [
                ...(organization.purchased_products ?? []),
                ...purchasedProductsForGroup
              ]
            }
          })
        }
      } catch (error) {
        console.error(`Error creating destination charge for group ${key}:`, error)
      }
    }
  } catch (error) {
    console.error(`Error creating one-time payment:`, error)
  }
  try {
    if (subscriptionProducts.length !== 0) {
      const manageSubscriptionResponse = await manageSubscription({
        promotionCode: promoCode,
        couponId: couponId,
        paymentMethodId: paymentMethod.id,
        products: subscriptionProducts,
        user,
        organization,
        remove: false,
        ipAddress,
        cartId // Pass cart ID to subscription management
      })
      if (manageSubscriptionResponse) {
        // manageSubscription will handle webhook receipt via cart tracking - no immediate purchases created
      }
    }
  } catch (error) {
    console.error(`Error managing subscription for user ${user.id}:`, error)
  }
  // Purchases will be created by webhook handlers, and receipt will be sent when all items in cart are processed
  // Return cart ID for tracking purposes
  return { cartId }
}