import { APIGatewayProxyEvent } from 'aws-lambda'
import { update } from '../helpers/dynamo-helpers/update'
import { get } from '../helpers/dynamo-helpers/get'
import { query } from '../helpers/dynamo-helpers/query'

export interface Purchase {
  id: string
  user_id: string
  product_id: string
  product_name: string
  is_one_time: boolean
  is_subscription: boolean
  purchased_at: string
  organization_id: string
  payment_method_id: string
  amount: number
  currency: string
  cart_id?: string
  platform_fee_amount?: number
  connected_account_id?: string
  destination_charge_id?: string
  transfer_id?: string
  tax_amount?: number
  base_amount?: number
  seller_organization_id?: string
  applied_discount?: {
    type: 'promotion_code' | 'coupon'
    code?: string
    coupon?: {
      id: string
      amount_off: number
      percent_off: number
    }
  },
  status: 'completed' | 'pending' | 'failed'
}

interface QueryStrategy {
  type: 'get' | 'query' | 'none'
  keyConditionExpression?: string
  expressionAttributeValues?: Record<string, unknown>
  indexName?: string
  canSort?: boolean
}

function determineQueryStrategy(purchase: Partial<Purchase>, sortBy: string): QueryStrategy {
  // Direct item lookup - most efficient
  if (purchase.id && purchase.user_id) {
    return { type: 'get' }
  }

  // Query by primary key (user_id + optional id sort key)
  if (purchase.user_id && !purchase.organization_id && !purchase.payment_method_id && !purchase.seller_organization_id) {
    return {
      type: 'query',
      keyConditionExpression: 'user_id = :user_id',
      expressionAttributeValues: { ':user_id': purchase.user_id },
      canSort: sortBy === 'id' // Primary table sorts by id (sort key)
    }
  }

  // Query by organization_id GSI (sorted by purchased_at)
  if (purchase.organization_id) {
    return {
      type: 'query',
      keyConditionExpression: 'organization_id = :organization_id',
      expressionAttributeValues: { ':organization_id': purchase.organization_id },
      indexName: 'organization_id-index',
      canSort: sortBy === 'purchased_at' // GSI sorts by purchased_at
    }
  }

  // Query by seller_organization_id GSI (sorted by purchased_at)
  if (purchase.seller_organization_id) {
    return {
      type: 'query',
      keyConditionExpression: 'seller_organization_id = :seller_organization_id',
      expressionAttributeValues: { ':seller_organization_id': purchase.seller_organization_id },
      indexName: 'seller_organization_id-index',
      canSort: sortBy === 'purchased_at' // GSI sorts by purchased_at
    }
  }

  // Query by payment_method_id GSI (sorted by purchased_at)
  if (purchase.payment_method_id) {
    return {
      type: 'query',
      keyConditionExpression: 'payment_method_id = :payment_method_id',
      expressionAttributeValues: { ':payment_method_id': purchase.payment_method_id },
      indexName: 'payment_method_id-index',
      canSort: sortBy === 'purchased_at' // GSI sorts by purchased_at
    }
  }

  return { type: 'none' }
}

export interface PurchasesInput {
  purchase: Partial<Purchase>
  type?: 'create' | 'update' | 'read'
  lastEvaluatedKey?: Record<string, unknown>
  limit?: number
  sortOrder?: 'ASC' | 'DESC'
  sortBy?: 'purchased_at' | 'id'
}

export const purchasesCrud = async (event: APIGatewayProxyEvent) => {
  const {
    purchase,
    type: purchaseType,
    lastEvaluatedKey,
    limit = 30,
    sortOrder = 'DESC',
    sortBy = 'purchased_at'
  }: PurchasesInput = JSON.parse(event.body || '{}')
  try {
    // read requests are allowed to not have the full key
    if ((purchase.id == null || purchase.user_id == null) && purchaseType !== 'read') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    if (purchaseType == null || !['read'].includes(purchaseType)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid purchase type' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }
    let response = {
      statusCode: 200,
      body: '',
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
    switch (purchaseType) {
      case 'update':
        const updatedPurchase = await update<Purchase>({
          tableName: process.env.PURCHASES_TABLE!,
          key: {
            id: purchase.id,
            user_id: purchase.user_id
          },
          updates: purchase,
          returnUpdated: true
        })
        if (updatedPurchase) {
          response.body = JSON.stringify(updatedPurchase)
        }
        break
      case 'read':
        let readPurchases: {
          items: Purchase[]
          lastEvaluatedKey?: Record<string, unknown>
        } | Purchase | undefined

        // Determine the best query strategy based on available parameters
        const queryStrategy = determineQueryStrategy(purchase, sortBy)

        if (queryStrategy.type === 'get') {
          // Direct item lookup using primary key
          readPurchases = await get<Purchase>({
            tableName: process.env.PURCHASES_TABLE!,
            key: {
              id: purchase.id!,
              user_id: purchase.user_id!
            }
          })
        } else if (queryStrategy.type === 'query' && queryStrategy.keyConditionExpression && queryStrategy.expressionAttributeValues) {
          // Query using primary table or GSI
          readPurchases = await query<Purchase>({
            tableName: process.env.PURCHASES_TABLE!,
            keyConditionExpression: queryStrategy.keyConditionExpression,
            expressionAttributeValues: queryStrategy.expressionAttributeValues,
            indexName: queryStrategy.indexName,
            limit,
            exclusiveStartKey: lastEvaluatedKey,
            sortOrder: queryStrategy.canSort ? sortOrder : 'DESC'
          })
        }

        if (readPurchases) {
          response.body = JSON.stringify(readPurchases)
        }
        break
    }
    if (response.body === '') {
      response.statusCode = 404
      response.body = JSON.stringify({ error: 'Purchase not found' })
    }
    return response
  } catch (error: unknown) {
    console.error('Error processing purchase:', error)
    return {
      statusCode: 500,
      body: (error as Error).message || 'Internal Server Error',
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
}
