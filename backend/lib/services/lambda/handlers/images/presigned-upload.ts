import {
  APIGatewayProxyEvent, APIGatewayProxyResult
} from 'aws-lambda'
import {
  S3Client, PutObjectCommand
} from '@aws-sdk/client-s3'
import {
  getSignedUrl
} from '@aws-sdk/s3-request-presigner'
import {
  v4 as uuidv4
} from 'uuid'

const s3Client = new S3Client({ region: process.env.AWS_REGION })

export const createPresignedUploadUrl = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const {
      fileName, fileType, fileSize
    } = JSON.parse(event.body || '{}')

    if (!fileName || !fileType) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({
          error: 'fileName and fileType are required'
        })
      }
    }

    // Validate file type (images only)
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp'
    ]
    
    if (!allowedTypes.includes(fileType)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({
          error: 'Only image files are allowed'
        })
      }
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB in bytes
    if (fileSize && fileSize > maxSize) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({
          error: 'File size must be less than 10MB'
        })
      }
    }

    const bucketName = process.env.IMAGES_BUCKET_NAME
    if (!bucketName) {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({
          error: 'Images bucket not configured'
        })
      }
    }

    // Generate unique key for the file
    const fileExtension = fileName.split('.').pop()
    const uniqueKey = `${uuidv4()}.${fileExtension}`

    // Create the S3 PutObject command
    const putObjectCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: uniqueKey,
      ContentType: fileType,
      ContentLength: fileSize
    })

    // Generate presigned URL (expires in 1 hour)
    const presignedUrl = await getSignedUrl(
      s3Client,
      putObjectCommand,
      { expiresIn: 3600 }
    )

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        uploadUrl: presignedUrl,
        key: uniqueKey,
        expiresIn: 3600
      })
    }

  } catch (error) {
    console.error('Error creating presigned URL:', error)
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        error: 'Failed to create presigned URL',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}