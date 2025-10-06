import { APIGatewayProxyEvent } from 'aws-lambda'
import { get } from '../../helpers/dynamo-helpers/get'
import { User } from '../users'
import { Organization } from '../organizations'
import { getOrganizationById } from '../../helpers/organizations/get-organization-by-id'
import { Product } from '../products'
import { generateLocationKey } from '../../helpers/tax/tax-calculation-cache'
import {
  calculateTaxesWithCaching, ItemsInterface 
} from '../../helpers/tax/calculate-taxes-with-caching'

export const calculateTaxes = async (event: APIGatewayProxyEvent) => {
  try {
    const { body } = event
    const {
      items, userId, ipAddress
    }: {
      items: ItemsInterface[]
      userId?: string
      ipAddress?: string
    } = JSON.parse(body || '{}')

    if (!Array.isArray(items) || items.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid request payload' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    let user: User | undefined
    let ip: string | undefined
    if (userId) {
      user = await get<User>({
        tableName: process.env.USERS_TABLE!,
        key: { id: userId }
      })

      if (user == null) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'User not found' }),
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true,
            'Content-Type': 'application/json'
          }
        }
      }
    } else if (ipAddress) {
      ip = ipAddress
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'User ID or IP address is required' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    // First fetch all products to check which ones require shipping
    const productPromises = [...new Set(items.map(item => `${item.group_id}:${item.id}`))].map(key => {
      const [
        groupId,
        productId
      ] = key.split(':')
      return get<Product>({
        tableName: process.env.PRODUCTS_TABLE!,
        key: {
          id: productId,
          group_id: groupId
        }
      })
    })
    const products = await Promise.all(productPromises)
    
    // Get all organization IDs for tax calculations (need stripe_account_id for each)
    const allOrgIds = new Set<string>()
    items.forEach(item => {
      allOrgIds.add(item.organization_id)
    })
    
    // Fetch all organizations referenced by items
    const organizations = await Promise.all([...allOrgIds].map(orgId => getOrganizationById(orgId)))
    
    // Also track which products require shipping for ship_from_details
    const shippingRequiredOrgIds = new Set<string>()
    products.forEach((product) => {
      if (product?.metadata?.shipping_required === 'true') {
        const item = items.find(i => `${i.group_id}:${i.id}` === `${product.group_id}:${product.id}`)
        if (item) {
          shippingRequiredOrgIds.add(item.organization_id)
        }
      }
    })
    const orgsHash = organizations.reduce((acc: { [orgId: string]: Organization }, org) => {
      if (org != null) {
        acc[org.id] = org
      }
      return acc
    }, {})
    const productsHash = products.reduce((acc: { [productKey: string]: Product }, product) => {
      if (product != null) {
        acc[`${product.group_id}:${product.id}`] = product
      }
      return acc
    }, {})

    // Generate location key for caching
    const location = generateLocationKey(user, ip)
    if (location === '') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Unable to determine location for tax calculation' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    
    // Calculate taxes for each unique product
    const taxCalculationResult = await calculateTaxesWithCaching(items, productsHash, orgsHash, location)
    
    return {
      statusCode: 200,
      body: JSON.stringify(taxCalculationResult),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } catch (error) {
    console.error('Error calculating taxes:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to calculate taxes' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
}