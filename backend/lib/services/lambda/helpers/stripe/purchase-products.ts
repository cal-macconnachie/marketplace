import {
  organizationsTableName, paymentMethodsTableName, productsTableName, usersTableName
} from '@marketplace/constants'
import {
  Organization, PaymentMethod,
  Product, Purchase, User
} from '@marketplace/types'
import { setCartPurchases } from '../add-purchase'
import { createPurchaseCart } from '../create-purchase-cart'
import { atomicUpdate } from '../dynamo-helpers/atomic-update'
import { get } from "../dynamo-helpers/get"
import { createSubscriptionPurchase } from './create-subscription-purchase'
import { createOneTimePurchase } from "./one-time-purchase"

export const purchaseProducts = async ({
  userId,
  paymentMethodId,
  productKeys,
  promoCode,
  couponId,
  ipAddress,
  shippingAddress
}: {
  userId: string,
  paymentMethodId?: string,
  productKeys: ({
    id: string
    group_id: string
  })[]
  promoCode?: string
  couponId?: string
  ipAddress?: string
  shippingAddress?: {
    full_name: string
    address_line1: string
    address_line2?: string
    city: string
    state: string
    postal_code: string
    country: string
  }
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
    tableName: usersTableName!,
    key: { id: userId }
  }),
  paymentMethodId ? get<PaymentMethod>({
    tableName: paymentMethodsTableName!,
    key: {
      user_id: userId,
      id: paymentMethodId
    }
  }) : Promise.resolve(undefined),
  await Promise.all(uniqueProductKeys.map(async (key) => {
    return get<Product>({
      tableName: productsTableName!,
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
  // validate products have available quantity for requested amounts and subtract available quantity
  const productUpdates: { id: string, group_id: string, quantity: number }[] = []
  for (const product of products) {
    if (product == null) {
      continue
    }
    if (product.quantity_limit != null && product.quantity == null) {
      throw new Error(`Malformed product quantity state for product: ${product.id}`)
    }
    if (product.quantity != null && product.quantity_limit == null) {
      throw new Error(`Malformed product quantity state for product: ${product.id}`)
    }
    const quantityRequested = productKeys.filter((key) => key.id === product.id && key.group_id === product.group_id).length
    if (product.quantity_limit != null && product.quantity != null) {
      if (quantityRequested > product.quantity_limit) {
        throw new Error(`Requested quantity exceeds available quantity for product: ${product.id}`)
      }
      if (product.quantity - quantityRequested < 0) {
        throw new Error(`Insufficient quantity available for product: ${product.id}`)
      }
      productUpdates.push({
        id: product.id,
        group_id: product.group_id,
        quantity: quantityRequested
      })
    }
  }
  if (productUpdates.length > 0) {
    await Promise.all(productUpdates.map(async (update) => {
      await atomicUpdate({
        tableName: productsTableName!,
        key: {
          id: update.id,
          group_id: update.group_id
        },
        updateExpression: 'SET quantity = quantity - :qty',
        expressionAttributeValues: {
          ':qty': update.quantity
        },
        conditionExpression: 'quantity >= :qty'
      })
    }))
  }
  try {
    const organization = await get<Organization>({
      tableName: organizationsTableName!,
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
          tableName: paymentMethodsTableName!,
          key: {
            user_id: organization.default_payment_method.user_id,
            id: organization.default_payment_method.id
          }
        }),
        currentUserHasOrgPaymentMethod ? Promise.resolve(user) : get<User>({
          tableName: usersTableName!,
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
    // Validate payment method is active
    if (paymentMethod.status === 'pending_verification') {
      throw new Error(`Payment method requires verification. Please complete the verification process before making purchases.`)
    }
    // Create a new cart for this purchase request
    const cart = await createPurchaseCart({
      userId,
      purchases: {},
      paymentMethodId: paymentMethod.id,
      ipAddress,
      shippingAddress
    })
    const cartId = cart.id
    const productsHash = products.filter(Boolean).reduce((acc: { [hash: string]: Product }, product) => {
      if (product) {
        acc[`${product.group_id}:${product.id}`] = product
      }
      return acc
    }, {})
    const productsToPurchase = productKeys.map((key) => productsHash[`${key.group_id}:${key.id}`]).filter(Boolean)
    const oneTimeProduct = productsToPurchase.filter((prod) => !Boolean(prod.default_price_data.recurring))
    const meteredSubscriptionProducts = productsToPurchase.filter((prod) =>
      Boolean(prod.default_price_data.recurring) && prod.default_price_data.recurring?.usage_type === 'metered'
    )
    const nonMeteredSubscriptionProducts = productsToPurchase.filter((prod) =>
      Boolean(prod.default_price_data.recurring) && prod.default_price_data.recurring?.usage_type !== 'metered'
    )

    // Batch fetch all unique seller organizations upfront
    const uniqueSellerOrgIds = [...new Set(productsToPurchase.map(p => p.organization_id))]
    const sellerOrganizations = await Promise.all(
      uniqueSellerOrgIds.map(orgId =>
        get<Organization>({
          tableName: organizationsTableName!,
          key: { id: orgId }
        })
      )
    )

    // Create hash map for quick lookup
    const sellerOrgsHash = sellerOrganizations.reduce((acc, org) => {
      if (org) {
        acc[org.id] = org
      }
      return acc
    }, {} as { [id: string]: Organization })

    // Validate all seller orgs were found
    for (const product of productsToPurchase) {
      if (!sellerOrgsHash[product.organization_id]) {
        throw new Error(`Seller organization not found: ${product.organization_id}`)
      }
    }

    const purchaseDataList: Purchase[] = []
    for (const product of oneTimeProduct) {
      try {
        const paymentResponse = await createOneTimePurchase({
          promotionCode: promoCode,
          couponId: couponId,
          paymentMethodId: paymentMethod.id,
          product,
          user,
          organization,
          sellerOrganization: sellerOrgsHash[product.organization_id],
          ipAddress,
          cartId
        })
        if (paymentResponse) {
          purchaseDataList.push(paymentResponse)
        }
      } catch (error) {
        console.error(`Error creating one-time payment for product ${product.id}:`, error)
      }
    }

    // Handle non-metered subscription products (can be combined in one cart)
    try {
      if (nonMeteredSubscriptionProducts.length !== 0) {
        for (const product of nonMeteredSubscriptionProducts) {
          const subscriptionResponse = await createSubscriptionPurchase({
            promotionCode: promoCode,
            couponId: couponId,
            paymentMethodId: paymentMethod.id,
            product,
            user,
            organization,
            sellerOrganization: sellerOrgsHash[product.organization_id],
            ipAddress,
            cartId
          })
          if (subscriptionResponse) {
            purchaseDataList.push(subscriptionResponse)
          }
        }
      }
    } catch (error) {
      console.error(`Error managing non-metered subscription for user ${user.id}:`, error)
    }

    // Set purchases for the main cart (one-time + non-metered subscriptions)
    if (purchaseDataList.length > 0) {
      await setCartPurchases({ purchases: purchaseDataList })
    }

    // Handle metered subscription products - each gets its own separate cart
    const meteredCartIds: string[] = []
    for (const product of meteredSubscriptionProducts) {
      try {
      // Create a new cart specifically for this metered subscription
        const meteredCart = await createPurchaseCart({
          userId,
          purchases: {},
          paymentMethodId: paymentMethod.id,
          shippingAddress
        })

        const meteredSubscriptionResponse = await createSubscriptionPurchase({
          promotionCode: promoCode,
          couponId: couponId,
          paymentMethodId: paymentMethod.id,
          product,
          user,
          organization,
          sellerOrganization: sellerOrgsHash[product.organization_id],
          ipAddress,
          cartId: meteredCart.id
        })

        if (meteredSubscriptionResponse) {
          await setCartPurchases({ purchases: [meteredSubscriptionResponse] })
          meteredCartIds.push(meteredCart.id)
        }
      } catch (error) {
        console.error(`Error managing metered subscription for user ${user.id}, product ${product.id}:`, error)
      }
    }

    return {
      cartId,
      meteredCartIds: meteredCartIds.length > 0 ? meteredCartIds : undefined
    }
  } catch (error) {
    // Rollback product quantity updates in case of any failure during purchase process
    if (productUpdates.length > 0) {
      await Promise.all(productUpdates.map(async (update) => {
        await atomicUpdate({
          tableName: productsTableName!,
          key: {
            id: update.id,
            group_id: update.group_id
          },
          updateExpression: 'SET quantity = quantity + :qty',
          expressionAttributeValues: {
            ':qty': update.quantity
          }
        })
      }))
    }
    throw error
  }
}