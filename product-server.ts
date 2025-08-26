import express from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { Product } from './lib/services/lambda/handlers/products'
import { listProducts } from './lib/services/lambda/handlers/product-manager/list'
import { getProduct } from './lib/services/lambda/handlers/product-manager/get'
import { createProduct } from './lib/services/lambda/handlers/product-manager/create'
import { updateProduct } from './lib/services/lambda/handlers/product-manager/update'
import { deleteProduct } from './lib/services/lambda/handlers/product-manager/delete'
import { createPromo } from './lib/services/lambda/handlers/promo-manager/create'
import { listPromos } from './lib/services/lambda/handlers/promo-manager/list'
import { updatePromos } from './lib/services/lambda/handlers/promo-manager/update'
import { deletePromo } from './lib/services/lambda/handlers/promo-manager/delete'

// Load environment variables
const envFile = process.env.ENV_FILE
if (!envFile || envFile.trim() === '') {
  throw new Error('ENV_FILE environment variable is not set')
}
dotenv.config({path: path.resolve(process.cwd(), envFile)})

const app = express()
app.use(cors())
app.use(express.json())

// Mock database - in real implementation, this would connect to DynamoDB
const mockDatabase = new Map<string, Product>()

// Serve the product manager HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'product-manager.html'))
})

// GET /products - List all products
app.get('/products', async (req, res) => {
  try {
    const request = {
      queryStringParameters: req.query as Record<string, string>
    }

    const result = await listProducts(request)

    if (result.error) {
      res.status(500).json({
        error: result.error,
        details: result.details
      })
    } else {
      res.status(200).json(result.data)
    }
  } catch (error) {
    console.error('Error fetching products:', error)
    res.status(500).json({
      error: 'Failed to fetch products',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// GET /products/:group_id/:id - Get specific product
app.get('/products/:group_id/:id', async (req, res) => {
  try {
    const {
      group_id, id
    } = req.params

    const request = {
      pathParameters: {
        group_id,
        id
      }
    }

    const result = await getProduct(request)

    if (result.error) {
      res.status(500).json({
        error: result.error,
        details: result.details
      })
    } else {
      res.status(200).json(result.data)
    }
  } catch (error) {
    console.error('Error fetching product:', error)
    res.status(500).json({
      error: 'Failed to fetch product',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// POST /products - Create new product
app.post('/products', async (req, res) => {
  try {
    const request = {
      body: req.body
    }

    const result = await createProduct(request)

    if (result.error) {
      res.status(500).json({
        error: result.error,
        details: result.details
      })
    } else {
      res.status(200).json(result.data)
    }
  } catch (error) {
    console.error('Error creating product:', error)
    res.status(400).json({
      error: 'Failed to create product',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// PUT /products/:group_id/:id - Update existing product
app.put('/products/:group_id/:id', async (req, res) => {
  try {
    const {
      group_id, id
    } = req.params

    const request = {
      body: req.body,
      pathParameters: {
        group_id,
        id
      }
    }

    const result = await updateProduct(request)

    if (result.error) {
      res.status(500).json({
        error: result.error,
        details: result.details
      })
    } else {
      res.status(200).json(result.data)
    }
  } catch (error) {
    console.error('Error updating product:', error)
    res.status(400).json({
      error: 'Failed to update product',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// DELETE /products/:group_id/:id - Delete product
app.delete('/products/:group_id/:id', async (req, res) => {
  try {
    const {
      group_id, id
    } = req.params

    const request = {
      pathParameters: {
        group_id,
        id
      }
    }

    const result = await deleteProduct(request)

    if (result.error) {
      res.status(500).json({
        error: result.error,
        details: result.details
      })
    } else {
      res.status(200).json(result.data)
    }
  } catch (error) {
    console.error('Error deleting product:', error)
    res.status(500).json({
      error: 'Failed to delete product',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// POST /promos - Create coupon or promotion code
app.post('/promos', async (req, res) => {
  try {
    const result = await createPromo(req.body)
    
    if (result.success) {
      res.status(200).json(result)
    } else {
      res.status(400).json(result)
    }
  } catch (error) {
    console.error('Error creating promo:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// GET /promos - List coupons or promotion codes (using POST to handle request body)
app.post('/promos/list', async (req, res) => {
  try {
    const result = await listPromos(req.body)
    
    if (result.success) {
      res.status(200).json(result)
    } else {
      res.status(400).json(result)
    }
  } catch (error) {
    console.error('Error listing promos:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// PUT /promos - Update coupon or promotion code
app.put('/promos', async (req, res) => {
  try {
    const result = await updatePromos(req.body)
    
    if (result.success) {
      res.status(200).json(result)
    } else {
      res.status(400).json(result)
    }
  } catch (error) {
    console.error('Error updating promo:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// DELETE /promos - Delete coupon or deactivate promotion code
app.delete('/promos', async (req, res) => {
  try {
    const result = await deletePromo(req.body)
    
    if (result.success) {
      res.status(200).json(result)
    } else {
      res.status(400).json(result)
    }
  } catch (error) {
    console.error('Error deleting promo:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: {
      connected: true,
      productCount: mockDatabase.size
    }
  })
})

// Shutdown endpoint
app.post('/shutdown', (req, res) => {
  res.json({message: 'Server shutting down...'})

  setTimeout(() => {
    console.log('Server shutdown requested via /shutdown endpoint')
    server.close(() => {
      console.log('HTTP server closed.')
      process.exit(0)
    })
  }, 1000)
})

const PORT = process.env.PORT || 3001
const server = app.listen(PORT, () => {
  console.log(`Product Management Server running on http://localhost:${PORT}`)
  console.log(`Product Manager UI available at http://localhost:${PORT}/`)
  console.log(`Environment file: ${process.env.NODE_ENV === 'production' ? '.env.local.production' : '.env.local'}`)
  console.log(`API endpoints:`)
  console.log(`  GET    /products`)
  console.log(`  POST   /products`)
  console.log(`  GET    /products/:group_id/:id`)
  console.log(`  PUT    /products/:group_id/:id`)
  console.log(`  DELETE /products/:group_id/:id`)
  console.log(`  POST   /promos`)
  console.log(`  POST   /promos/list`)
  console.log(`  PUT    /promos`)
  console.log(`  DELETE /promos`)
  console.log(`  GET    /health`)
  console.log(`  POST   /shutdown`)
})

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT. Graceful shutdown...')
  server.close(() => {
    console.log('HTTP server closed.')
    process.exit(0)
  })
})

process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Graceful shutdown...')
  server.close(() => {
    console.log('HTTP server closed.')
    process.exit(0)
  })
})
