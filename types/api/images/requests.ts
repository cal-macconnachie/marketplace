/**
 * Request to create a presigned URL for image upload
 */
export interface CreatePresignedUploadUrlRequest {
  filename: string
  contentType: string
}

/**
 * Request parameters sent to backend handler for presigned URL
 * @internal Backend handler format
 */
export interface PresignedUploadBackendRequest {
  fileName: string
  fileType: string
}
