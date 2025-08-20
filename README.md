# Payment Auth Backend

A comprehensive backend system built with AWS CDK and TypeScript for payment processing, user authentication, and product management. This system integrates with Stripe for payment processing and AWS Cognito for user authentication.

## Architecture Overview

This CDK application deploys several key services:

- **Authentication**: AWS Cognito for user management with social sign-on support
- **Database**: DynamoDB tables for users, products, organizations, payment methods, and promotions
- **Payments**: Stripe integration for payment processing and subscription management  
- **Product Management**: CRUD operations for products with Stripe synchronization
- **API**: Lambda functions providing REST endpoints for all operations

### Key Features

- User authentication and authorization with JWT tokens
- Organization-based user management with role-based permissions
- Product catalog with Stripe integration for pricing and subscriptions
- Payment method management and subscription handling
- Promotional code system with various discount types
- Real-time synchronization between DynamoDB and Stripe via streams

## Product Manager

The product manager is a development tool that provides a local Express server for managing products and promotions. It allows you to create, read, update, and delete products and promotional codes through a REST API.

### Product Manager Features

- **Product Management**: Full CRUD operations for products
  - Create products with pricing, metadata, and marketing features
  - Update existing products with automatic Stripe synchronization
  - List and filter products by group ID
  - Delete/archive products safely

- **Promotion Management**: Create and manage promotional codes
  - Support for different promotion types (coupons, discounts)
  - List and update promotional codes
  - Deactivate expired or unused promotions

- **Development Server**: Local testing environment
  - Express.js server with CORS support
  - Hot reload with nodemon for development
  - Environment-based configuration (.env.local vs .env.local.production)
  - Health check and graceful shutdown endpoints

### Starting the Product Manager

```bash
# For development environment
npm run product-manager

# For production environment  
npm run product-manager-production
```

The server runs on http://localhost:3001 with the following endpoints:

**Product Endpoints:**
- `GET /products` - List all products
- `POST /products` - Create new product
- `GET /products/:group_id/:id` - Get specific product
- `PUT /products/:group_id/:id` - Update existing product
- `DELETE /products/:group_id/:id` - Delete/archive product

**Promotion Endpoints:**
- `POST /promos` - Create promotional code
- `POST /promos/list` - List promotional codes
- `PUT /promos` - Update promotional code
- `DELETE /promos` - Delete/deactivate promotional code

**Utility Endpoints:**
- `GET /health` - Health check
- `POST /shutdown` - Graceful server shutdown

## Development Commands

* `npm run build` - Compile TypeScript to JavaScript
* `npm run watch` - Watch for changes and compile
* `npm run test` - Run Jest unit tests
* `npm run lint` - Run ESLint on TypeScript files
* `npm run clean` - Remove compiled JavaScript files
* `npx cdk deploy` - Deploy stack to AWS
* `npx cdk diff` - Compare deployed stack with current state
* `npx cdk synth` - Generate CloudFormation template

## Environment Setup

Create `.env.local` and `.env.local.production` files with the required environment variables for local development of the product manager.
