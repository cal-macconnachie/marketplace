import type { Organization } from '../../entities/organization'
import type { User } from '../../entities/user'

/**
 * Request to get an organization by ID
 */
export interface GetOrganizationRequest {
  id: string
}

/**
 * Request to update an organization
 */
export interface UpdateOrganizationRequest extends Partial<Organization> {
  id: string
}

/**
 * Request to get users by cognito_id
 */
export interface GetUsersRequest {
  cognito_id: string
}

/**
 * Request to update a user
 */
export interface UpdateUserRequest extends Partial<User> {
  id: string
}
