import { APIGatewayProxyEvent } from 'aws-lambda'
import { createConnectedAccount } from '../../helpers/stripe/create-connected-account'
import { getUserByEmail } from '../../helpers/users/get-user-by-email'
import { getOrganizationById } from '../../helpers/organizations/get-organization-by-id'

interface CreateConnectedAccountRequest {
  companyDetails: {
    name: string
    address: {
      line1: string
      line2: string
      city: string
      state: string
      postal_code: string
      country: string
    }
    phone: string
    tax_id: string
  }
  bankDetails: {
    account_number: string
    country?: string
    currency?: string
    routing_number: string
    account_holder_name?: string
    account_holder_type?: 'individual' | 'company'
  }
  businessProfile?: {
    mcc?: string
    url?: string
    product_description?: string
  }
  refreshUrl: string
  returnUrl: string
}

export const createConnectedAccountHandler = async (event: APIGatewayProxyEvent) => {
  try {
    const userEmail = event.requestContext.authorizer?.claims?.email
    if (!userEmail) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized - user ID not found' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    const requestBody: CreateConnectedAccountRequest = JSON.parse(event.body ?? '{}')
    
    // Validate required fields
    const {
      companyDetails,
      bankDetails,
      businessProfile,
      refreshUrl,
      returnUrl
    } = requestBody

    if (!companyDetails || !bankDetails || !refreshUrl || !returnUrl) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Missing required fields: companyDetails, bankDetails, refreshUrl, returnUrl' 
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    // Validate company details
    if (!companyDetails.name || !companyDetails.address || !companyDetails.phone || !companyDetails.tax_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Missing required company details: name, address, phone, tax_id' 
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    // Validate bank details
    if (!bankDetails.account_number || !bankDetails.routing_number) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Missing required bank details: account_number, routing_number' 
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    // Check if user exists
    const user = await getUserByEmail(userEmail)

    if (!user) {
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

    const organizationId = user.organization_id
    const organization = await getOrganizationById(organizationId)
    if (!organization) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Organization not found' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    // Check if user already has a connected account
    if (organization.stripe_account_id) {
      return {
        statusCode: 409,
        body: JSON.stringify({ 
          error: 'User already has a connected Stripe account',
          account_id: organization.stripe_account_id
        }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        }
      }
    }

    // Create the connected account
    const result = await createConnectedAccount({
      userId: user.id,
      companyDetails,
      bankDetails,
      businessProfile,
      refreshUrl,
      returnUrl
    })

    return {
      statusCode: 201,
      body: JSON.stringify({
        account_id: result.account.id,
        requires_onboarding: result.requiresOnboarding,
        onboarding_url: result.onboardingUrl,
        missing_requirements: result.missingRequirements,
        charges_enabled: result.account.charges_enabled,
        payouts_enabled: result.account.payouts_enabled,
        details_submitted: result.account.details_submitted
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  } catch (error) {
    console.error('Error creating connected account:', error)
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: (error as Error).message || 'Failed to create connected account'
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
      }
    }
  }
}