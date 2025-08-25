import { APIGatewayProxyEvent } from 'aws-lambda'
import {
  createPromo, CreatePromoRequest 
} from './create'
import {
  UpdateCouponRequest, updatePromos, UpdatePromotionCodeRequest 
} from './update'
import {
  ListCouponsRequest, listPromos, ListPromotionCodesRequest 
} from './list'
import {
  DeleteCouponRequest, deletePromo, DeletePromotionCodeRequest 
} from './delete'
import { getUserByEmail } from '../../helpers/users/get-user-by-email'

export const promoManager = async (event: APIGatewayProxyEvent) => {
  try {
    const body: {
      type: string
      input: unknown
    } = JSON.parse(event.body || '{}')

    const requesterEmail = event.requestContext?.authorizer?.claims?.email
    if (!requesterEmail) {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Unauthorized' })
      }
    }
    const user = await getUserByEmail(requesterEmail)
    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'User not found' })
      }
    }
    if (!user.is_organization_admin) {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Forbidden' })
      }
    }
    let finalRes: unknown
    switch (body.type) {
      case 'create':
        finalRes = await createPromo(body.input as CreatePromoRequest)
        break
      case 'delete':
        finalRes = await deletePromo(body.input as { type: 'coupon' } & DeleteCouponRequest | { type: 'promotion_code' } & DeletePromotionCodeRequest)
        break
      case 'list':
        finalRes = await listPromos(body.input as { type: 'coupons' } & ListCouponsRequest | { type: 'promotion_codes' } & ListPromotionCodesRequest)
        break
      case 'update':
        finalRes = await updatePromos(body.input as { type: 'coupon' } & UpdateCouponRequest | { type: 'promotion_code' } & UpdatePromotionCodeRequest)
        break
      default:
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: 'Invalid promo type'
          }),
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true,
            'Content-Type': 'application/json'
          }
        }
    }
    return {
      statusCode: 200,
      body: JSON.stringify(finalRes),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } catch (error) {
    console.error('Error parsing JSON:', error)
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'Invalid JSON',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
}
