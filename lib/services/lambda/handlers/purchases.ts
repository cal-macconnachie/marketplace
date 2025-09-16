import { APIGatewayProxyEvent } from 'aws-lambda'
import { create } from '../helpers/dynamo-helpers/create'
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
  platform_fee_amount?: number
  connected_account_id?: string
  destination_charge_id?: string
  transfer_id?: string
  tax_amount?: number
  base_amount?: number
}

function validatePurchase(purchase: Partial<Purchase>): Purchase | false {
  if (
    typeof purchase.id === 'string' &&
    typeof purchase.user_id === 'string' &&
    typeof purchase.product_id === 'string' &&
    typeof purchase.product_name === 'string' &&
    typeof purchase.is_one_time === 'boolean' &&
    typeof purchase.is_subscription === 'boolean' &&
    typeof purchase.purchased_at === 'string' &&
    typeof purchase.organization_id === 'string' &&
    typeof purchase.payment_method_id === 'string'
  ) {
    return purchase as Purchase
  }
  return false
}

export interface PurchasesInput {
  purchase: Partial<Purchase>
  type?: 'create' | 'update' | 'read'
  lastEvaluatedKey?: Record<string, unknown>
  limit?: number
}

export const purchasesCrud = async (event: APIGatewayProxyEvent) => {
  const {
    purchase,
    type: purchaseType,
    lastEvaluatedKey,
    limit = 30
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
      case 'create':
        // Handle create
        const validatedPurchase = validatePurchase(purchase)
        if (validatedPurchase) {
          const pur = await create<Purchase>({
            tableName: process.env.PURCHASES_TABLE!,
            key: {
              id: validatedPurchase.id,
              user_id: validatedPurchase.user_id
            },
            record: validatedPurchase,
            returnCreated: true
          })
          if (pur) {
            response.body = JSON.stringify(pur)
          }
        }
        break
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
        // indexes organization_id-index payment_method_id-index sort purchased_at
        // key user_id sort id
        if (purchase.id && purchase.user_id) {
          readPurchases = await get<Purchase>({
            tableName: process.env.PURCHASES_TABLE!,
            key: {
              id: purchase.id,
              user_id: purchase.user_id
            }
          })
        }
        if (purchase.user_id && !purchase.id) {
          readPurchases = await query<Purchase>({
            tableName: process.env.PURCHASES_TABLE!,
            keyConditionExpression: 'user_id = :user_id',
            expressionAttributeValues: {
              ':user_id': purchase.user_id
            },
            limit,
            exclusiveStartKey: lastEvaluatedKey
          })
        }
        if (readPurchases) {
          response.body = JSON.stringify(readPurchases)
        } else {
          if (purchase.organization_id) {
            readPurchases = await query<Purchase>({
              tableName: process.env.PURCHASES_TABLE!,
              indexName: 'organization_id-index',
              keyConditionExpression: 'organization_id = :organization_id',
              expressionAttributeValues: {
                ':organization_id': purchase.organization_id
              },
              limit,
              exclusiveStartKey: lastEvaluatedKey
            })
          } else if (purchase.payment_method_id) {
            readPurchases = await query<Purchase>({
              tableName: process.env.PURCHASES_TABLE!,
              indexName: 'payment_method_id-index',
              keyConditionExpression: 'payment_method_id = :payment_method_id',
              expressionAttributeValues: {
                ':payment_method_id': purchase.payment_method_id
              },
              limit,
              exclusiveStartKey: lastEvaluatedKey
            })
          }
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
