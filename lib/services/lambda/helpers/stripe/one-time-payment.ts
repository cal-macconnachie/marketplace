import {
  Product, PurchasedProduct 
} from "../../handlers/products"
import { User } from "../../handlers/users"
import { getPromoByCode } from "./get-promo-by-code"
import { getStripeClient } from "./stripe-client"
import { update } from "../dynamo-helpers/update"
import { Organization } from "../../handlers/organizations"
import { addPurchase } from '../add-purchase'
import { v4 } from 'uuid'
import {
  calculatePlatformFee, calculateConnectedAccountAmount 
} from './calculate-platform-fee'
import {
  calculateTaxesWithCaching, ItemsInterface 
} from '../tax/calculate-taxes-with-caching'
import { generateLocationKey } from '../tax/tax-calculation-cache'

export const createOneTimePayment = async ({
  promotionCode,
  couponId,
  product,
  paymentMethodId,
  user,
  organization,
  taxCode,
  ipAddress
}: {
  promotionCode?: string
  couponId?: string
  paymentMethodId?: string
  product: Product
  user: User
  organization: Organization
  taxCode?: string
  ipAddress?: string
}) => {
  const stripe = getStripeClient()
  const customerId = user.stripe_id
  // Implementation for creating a one-time payment using Stripe API
  // Use connected account when retrieving product
  const [stripeProduct] = await Promise.all([
    stripe.products.retrieve(product.id, {
      stripeAccount: product.account_id
    })
  ])
  const priceId = typeof stripeProduct.default_price === 'string' ? stripeProduct.default_price : stripeProduct.default_price?.id

  if (!priceId) {
    throw new Error(`No price_id found for product ${product.id}`)
  }
  if (!organization) {
    throw new Error(`Organization not found for user ${user.id}`)
  }

  // Calculate discount amount if promotion code or coupon is provided
  let discountAmount = 0
  let originalAmount = product.default_price_data.unit_amount
  let finalAmount = originalAmount
  let appliedDiscount = null

  if (promotionCode || couponId) {
    try {
      let discount = null
      
      if (promotionCode) {
        // Look up promotion code in database to get the actual Stripe promotion code ID
        const promoRecord = await getPromoByCode(promotionCode)
        if (!promoRecord || promoRecord.type !== 'promotion_code') {
          throw new Error(`Promotion code ${promotionCode} not found`)
        }
        
        // Use stripeId if available, fallback to id for backwards compatibility
        const stripePromoId = promoRecord.stripeId || promoRecord.id
        
        // Validate and retrieve promotion code from Stripe
        const promoCode = await stripe.promotionCodes.retrieve(stripePromoId, {
          stripeAccount: product.account_id
        })
        if (!promoCode.active) {
          throw new Error(`Promotion code ${promotionCode} is not active`)
        }
        discount = promoCode.coupon
        appliedDiscount = {
          type: 'promotion_code', code: promotionCode, coupon: discount 
        }
      } else if (couponId) {
        // Validate and retrieve coupon
        discount = await stripe.coupons.retrieve(couponId, {
          stripeAccount: product.account_id
        })
        if (!discount.valid) {
          throw new Error(`Coupon ${couponId} is not valid`)
        }
        appliedDiscount = {
          type: 'coupon', coupon: discount 
        }
      }

      if (discount) {
        // Calculate discount amount based on coupon type
        if (discount.percent_off) {
          discountAmount = Math.round((originalAmount * discount.percent_off) / 100)
        } else if (discount.amount_off && discount.currency === product.default_price_data.currency) {
          discountAmount = discount.amount_off
        }
        
        // Ensure discount doesn't exceed original amount
        discountAmount = Math.min(discountAmount, originalAmount)
        finalAmount = Math.max(originalAmount - discountAmount, 0)
      }
    } catch (error) {
      throw new Error(`Invalid discount code: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Ensure minimum charge amount (Stripe requires at least 50 cents for most currencies)
  const minimumAmount = 50 // 50 cents in most currencies
  if (finalAmount < minimumAmount) {
    finalAmount = minimumAmount
    discountAmount = originalAmount - finalAmount
  }

  // Calculate tax using Stripe Tax API for better itemization
  let taxAmount = 0
  let taxRate = 0
  let taxCalculationId = null
  let detailedTaxBreakdown = ''
  let calculatedTotalAmount = 0 // Total from Stripe Tax API including tax
  const customerLocation = generateLocationKey(user, ipAddress)
  
  console.log('Tax calculation debug:', { 
    customerLocation, 
    hasUserAddress: !!user.address,
    userAddressData: user.address 
  })
  
  // Try Stripe Tax API if we have address info, otherwise fallback to legacy
  if (user.address && user.address.country) {
    try {
      // Create Stripe Tax Calculation for detailed tax breakdown
      const taxCalculation = await stripe.tax.calculations.create({
        currency: product.default_price_data.currency,
        line_items: [
          {
            amount: finalAmount,
            reference: `product_${product.id}`,
            tax_code: taxCode || product.tax_code || 'txcd_99999999' // General product tax code
          }
        ],
        customer_details: {
          address: {
            line1: user.address.line_1 || 'Unknown',
            line2: user.address.line_2 || undefined,
            city: user.address.city || 'Unknown',
            state: user.address.state || undefined,
            postal_code: user.address.postal_code || undefined,
            country: user.address.country
          },
          address_source: 'billing'
        },
        expand: ['line_items']
      }, {
        stripeAccount: product.account_id
      })
      
      if (taxCalculation.line_items?.data && taxCalculation.line_items?.data?.length > 0) {
        taxCalculationId = taxCalculation.id
        
        // Use the total amount from Stripe Tax API (includes tax)
        calculatedTotalAmount = taxCalculation.amount_total
        
        // Sum up tax amounts from all line items
        taxAmount = taxCalculation.line_items.data.reduce((total, lineItem) => {
          return total + lineItem.amount_tax
        }, 0)
        
        // Calculate weighted average tax rate and build detailed breakdown
        let totalTaxableAmount = 0
        let weightedTaxRate = 0
        const taxBreakdownItems: string[] = []
        
        taxCalculation.line_items.data.forEach(lineItem => {
          if (lineItem.tax_breakdown && lineItem.tax_breakdown.length > 0) {
            lineItem.tax_breakdown.forEach(breakdown => {
              if (breakdown.tax_rate_details?.percentage_decimal && breakdown.taxable_amount > 0) {
                const rate = parseFloat(breakdown.tax_rate_details.percentage_decimal)
                const weight = breakdown.taxable_amount
                const taxType = breakdown.tax_rate_details.tax_type || 'tax'
                const jurisdiction = breakdown.jurisdiction?.display_name || 
                  `${breakdown.tax_rate_details.percentage_decimal || ''} ${breakdown.tax_rate_details.tax_type || ''}`.trim()
                
                weightedTaxRate += rate * weight
                totalTaxableAmount += weight
                
                // Add to detailed breakdown
                taxBreakdownItems.push(`${jurisdiction} ${taxType}: ${rate}% (${breakdown.amount})`)
              }
            })
          }
        })
        
        // Calculate final weighted average rate
        if (totalTaxableAmount > 0) {
          taxRate = weightedTaxRate / totalTaxableAmount
        }
        
        // Create detailed tax breakdown string
        detailedTaxBreakdown = taxBreakdownItems.length > 0 
          ? taxBreakdownItems.join('; ') 
          : `Tax: ${taxAmount} on ${finalAmount}`
          
        console.log('Stripe Tax API success:', {
          calculatedTotalAmount,
          taxAmount,
          taxRate,
          detailedTaxBreakdown
        })
      }
    } catch (error: unknown) {
      console.error('Stripe Tax calculation failed, falling back to legacy calculation:', error)
      
      // Fallback to legacy tax calculation
      const taxItem: ItemsInterface = {
        id: product.id,
        group_id: product.group_id,
        organization_id: organization.id,
        quantity: 1
      }
      
      const modifiedProduct = {
        ...product,
        default_price_data: {
          ...product.default_price_data,
          unit_amount: finalAmount
        }
      }
      
      if (taxCode) {
        modifiedProduct.tax_code = taxCode
      }
      
      const productsHash = {
        [`${product.group_id}:${product.id}`]: modifiedProduct
      }
      
      const orgsHash = {
        [organization.id]: organization
      }
      
      const legacyTaxCalculation = await calculateTaxesWithCaching(
        [taxItem],
        productsHash,
        orgsHash,
        customerLocation
      )
      
      if (legacyTaxCalculation.items.length > 0) {
        taxAmount = legacyTaxCalculation.items[0].tax_amount
        taxRate = legacyTaxCalculation.items[0].tax_rate
      }
    }
  } else {
    console.log('No tax calculation attempted - missing user address or country')
  }
  
  console.log('Final tax calculation result:', {
    taxAmount,
    taxRate,
    calculatedTotalAmount,
    finalTotalAmount: calculatedTotalAmount > 0 ? calculatedTotalAmount : finalAmount + taxAmount
  })

  // Use calculated total from Stripe Tax API if available, otherwise manual calculation
  const totalAmount = calculatedTotalAmount > 0 ? calculatedTotalAmount : finalAmount + taxAmount

  // Calculate platform fee on the base amount (before tax)
  const platformFeeAmount = await calculatePlatformFee({
    amount: finalAmount, organizationId: organization.id 
  })
  const connectedAccountAmount = calculateConnectedAccountAmount(finalAmount, platformFeeAmount)

  // Create a PaymentIntent using destination charges pattern with tax itemization
  const paymentIntentCreateParams = {
    amount: totalAmount, // Total amount including tax
    currency: product.default_price_data.currency,
    customer: customerId,
    payment_method: paymentMethodId,
    transfer_data: {
      destination: product.account_id,
    },
    application_fee_amount: platformFeeAmount, // Platform fee on base amount
    on_behalf_of: product.account_id, // Makes connected account settlement merchant
    metadata: {
      userId: user.id,
      productId: product.id,
      productGroupId: product.group_id,
      type: 'one_time_payment',
      original_amount: originalAmount.toString(),
      discount_amount: discountAmount.toString(),
      tax_amount: taxAmount.toString(),
      tax_rate: taxRate.toString(),
      base_amount: finalAmount.toString(), // Amount before tax
      total_amount: totalAmount.toString(), // Amount including tax
      platform_fee_amount: platformFeeAmount.toString(),
      connected_account_amount: connectedAccountAmount.toString(),
      // Enhanced tax itemization metadata
      subtotal: finalAmount.toString(), // Clear subtotal before tax
      tax_breakdown: detailedTaxBreakdown || `Tax: ${taxAmount} on ${finalAmount}`, // Human readable tax breakdown
      ...(taxCalculationId && { 
        stripe_tax_calculation_id: taxCalculationId,
        tax_method: 'stripe_tax_api'
      }),
      ...(appliedDiscount && {
        discount_type: appliedDiscount.type,
        discount_code: appliedDiscount.code || appliedDiscount.coupon.id
      }),
      ...(customerLocation && { customer_location: customerLocation }),
      ...(taxCode && { tax_code: taxCode })
    },
    automatic_payment_methods: {
      enabled: true,
      allow_redirects: 'never' as const
    }
  }

  const paymentIntent = await stripe.paymentIntents.create(paymentIntentCreateParams)

  if (!paymentIntent) {
    throw new Error('Failed to create payment intent')
  }
  const confirmedPaymentIntent = await stripe.paymentIntents.confirm(paymentIntent.id, {})
  // NO stripeAccount parameter - confirming platform payment intent
  if (confirmedPaymentIntent.status !== 'succeeded') {
    return {
      success: false,
      message: `Payment failed with status: ${confirmedPaymentIntent.status}`,
      paymentIntentId: paymentIntent.id,
      next: confirmedPaymentIntent.next_action
    }
  }
  const purchasedProduct: PurchasedProduct = {
    id: product.id,
    group_id: product.group_id,
    name: product.name,
    metadata: product.metadata,
    unique_id: confirmedPaymentIntent.id,
    user_id: user.id,
    amount: totalAmount, // Total amount including tax
    currency: product.default_price_data.currency
  }
  // Calculate expiration time based on product metadata 'time' field or default to 1 hour
  const currentTime = Math.floor(Date.now() / 1000) // Use seconds to match Stripe format
  
  // Check if product has a 'time' metadata field (still in seconds from metadata)
  let durationInSeconds = 60 * 60 // Default to 1 hour (3600 seconds)
  
  if (product.metadata?.time) {
    const timeValue = parseInt(product.metadata.time, 10)
    // Validate time value: must be positive and not exceed 100 years (3155673600 seconds)
    const maxDuration = 3155673600 // 100 years in seconds
    if (!isNaN(timeValue) && timeValue > 0 && timeValue <= maxDuration) {
      durationInSeconds = timeValue
    }
    const expirationTime = currentTime + durationInSeconds
    purchasedProduct.in_good_standing_until = expirationTime
  }
  await update<Organization>({
    tableName: process.env.ORGANIZATIONS_TABLE!,
    key: {
      id: user.organization_id
    },
    updates: {
      purchased_products: (organization.purchased_products ?? []).concat([purchasedProduct])
    }
  })
  await addPurchase({
    id: v4(),
    user_id: user.id,
    product_id: product.id,
    organization_id: user.organization_id,
    purchased_at: new Date().toISOString(),
    is_one_time: true,
    is_subscription: false,
    payment_method_id: paymentMethodId!,
    product_name: product.name,
    amount: totalAmount, // Total amount including tax
    currency: product.default_price_data.currency,
    platform_fee_amount: platformFeeAmount,
    connected_account_id: product.account_id,
    destination_charge_id: confirmedPaymentIntent.id,
    tax_amount: taxAmount,
    base_amount: finalAmount // Amount before tax
  })
  return {
    success: true,
    message: 'One-time payment successful',
    paymentIntentId: confirmedPaymentIntent.id,
    purchasedProduct
  }
}
