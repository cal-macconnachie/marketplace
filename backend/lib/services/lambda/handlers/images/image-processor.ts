import {
  APIGatewayProxyEvent, APIGatewayProxyResult 
} from 'aws-lambda'
import {
  S3Client, GetObjectCommand 
} from '@aws-sdk/client-s3'
import sharp from 'sharp'

const s3Client = new S3Client({ region: process.env.AWS_REGION })

export const processImage = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Extract key from path - handle both API Gateway proxy and Lambda Function URL
    let key = event.pathParameters?.proxy
    
    // If no proxy parameter (Lambda Function URL), extract from raw path
    if (!key) {
      // For Lambda Function URL, check different path properties
      const lambdaEvent = event as unknown as { rawPath?: string; requestContext?: { http?: { path?: string } } }
      const rawPath = lambdaEvent.rawPath || lambdaEvent.requestContext?.http?.path || event.path
      if (rawPath) {
        // Remove leading slash and extract everything as the image path
        const pathWithoutSlash = rawPath.startsWith('/') ? rawPath.slice(1) : rawPath
        key = pathWithoutSlash
      }
    }

    if (!key) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Image key is required' })
      }
    }

    // Extract query parameters
    const queryParams = event.queryStringParameters || {}
    const width = queryParams.w
    const height = queryParams.h  
    const quality = queryParams.q

    const bucketName = process.env.IMAGES_BUCKET_NAME
    if (!bucketName) {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Images bucket not configured' })
      }
    }

    // Get the original image from S3
    const getObjectCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: key
    })

    const response = await s3Client.send(getObjectCommand)
    
    if (!response.Body) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({ error: 'Image not found' })
      }
    }

    const imageData = await response.Body.transformToByteArray()
    const imageResize = sharp(imageData).resize({
      width: width ? parseInt(width) : undefined,
      height: height ? parseInt(height) : undefined,
      fit: 'cover'
    })
    if (isJpegContentType({ contentType: response.ContentType })) imageResize.jpeg({ quality: quality ? parseInt(quality) : 100 })
    if (isPngContentType({ contentType: response.ContentType })) imageResize.png({ palette: true })
    const resizedImageData = await imageResize.toBuffer()

    return {
      statusCode: 200,
      headers: {
        'Content-Type': response.ContentType || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Cache-Control': 'public, max-age=31536000'
      },
      body: resizedImageData.toString('base64'),
      isBase64Encoded: true
    }

  } catch (error) {
    console.error('Error processing image:', error)
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({ 
        error: 'Failed to process image',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

function isJpegContentType({ contentType }: { contentType?: string }) {
  return contentType === 'image/jpeg'
}

function isPngContentType({ contentType }: { contentType?: string }) {
  return contentType === 'image/png'
}
