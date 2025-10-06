/**
 * Response from creating a presigned upload URL
 */
export interface CreatePresignedUploadUrlResponse {
  uploadUrl: string
  key: string
  expiresIn: number
}
