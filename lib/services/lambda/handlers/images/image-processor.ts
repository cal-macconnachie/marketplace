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
    // Extract key from path parameters
    const key = event.pathParameters?.proxy

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

    // Convert the readable stream to buffer
    const chunks: Uint8Array[] = []
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const chunk of response.Body as any) {
      chunks.push(chunk)
    }
    
    const imageBuffer = Buffer.concat(chunks)

    // Process the image with Sharp
    let processedImage = sharp(imageBuffer)

    // Apply resizing if dimensions provided
    if (width || height) {
      processedImage = processedImage.resize({
        width: width ? parseInt(width) : undefined,
        height: height ? parseInt(height) : undefined,
        fit: 'inside',
        withoutEnlargement: true
      })
    }

    // Only recompress if quality is explicitly requested or if size exceeds limits
    let processedBuffer: Buffer
    let isJpegOutput = false
    const MAX_SIZE_BYTES = 5.5 * 1024 * 1024 // 5.5MB

    if (quality) {
      // Explicit quality requested - recompress as JPEG
      processedImage = processedImage.jpeg({ quality: parseInt(quality) })
      processedBuffer = await processedImage.toBuffer()
      isJpegOutput = true
    } else {
      // No quality specified - try to preserve original format/quality
      processedBuffer = await processedImage.toBuffer()
      
      // Only recompress if the result is too large for Lambda
      if (processedBuffer.length > MAX_SIZE_BYTES) {
        let currentQuality = 85
        
        do {
          // Reset and reapply transformations with JPEG compression
          processedImage = sharp(imageBuffer)
          
          if (width || height) {
            processedImage = processedImage.resize({
              width: width ? parseInt(width) : undefined,
              height: height ? parseInt(height) : undefined,
              fit: 'inside',
              withoutEnlargement: true
            })
          }
          
          processedImage = processedImage.jpeg({ quality: currentQuality })
          processedBuffer = await processedImage.toBuffer()
          isJpegOutput = true
          
          if (processedBuffer.length > MAX_SIZE_BYTES && currentQuality > 10) {
            currentQuality -= 5
          } else {
            break
          }
        } while (processedBuffer.length > MAX_SIZE_BYTES && currentQuality > 10)
      }
    }

    // If still too large even at minimum quality, return error
    if (processedBuffer.length > MAX_SIZE_BYTES) {
      return {
        statusCode: 413,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({
          error: 'Image too large to process',
          details: 'Unable to compress image below size limit'
        })
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': isJpegOutput ? 'image/jpeg' : response.ContentType || 'image/jpeg',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Cache-Control': 'public, max-age=31536000'
      },
      body: processedBuffer.toString('base64'),
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