# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Build and Test**
- `yarn build` - Compile TypeScript to JavaScript
- `yarn watch` - Watch for changes and compile continuously  
- `yarn test` - Run Jest unit tests (tests located in `/test` directory)
- `yarn lint` - Run ESLint on TypeScript files in lib/

**CDK Deployment**
- `yarn cdk deploy` - Deploy stack to AWS
- `yarn cdk diff` - Compare deployed stack with current state
- `yarn cdk synth` - Generate CloudFormation template

**Product Manager (Development Tool)**
- `yarn product-manager` - Start local Express server on port 3001 (.env.local)
- `yarn product-manager-production` - Start with production config (.env.local.production)

**Cleanup**
- `yarn clean` - Remove compiled JavaScript and declaration files

## Architecture Overview

This is an AWS CDK application built with TypeScript that provides a payment processing and user authentication backend. The system integrates with Stripe for payments and AWS Cognito for authentication.

### Core Stack Structure

- **Main Stack**: `PaymentAuthBackendStack` orchestrates all services
- **DynamoDB Stack**: `DdbTablesStack` - manages all database tables
- **Cognito Stack**: `CognitoStack` - handles user authentication with social sign-on
- **Lambda Stack**: `LambdaStack` - manages API Gateway and all Lambda functions

### Key Services Integration

**Stripe Integration**
- Singleton Stripe client via `getStripeClient()` in `lib/services/lambda/helpers/stripe/stripe-client.ts`
- Payment processing, subscription management, and product synchronization
- Stripe webhook handling via `stripe-event-handler.ts`
- Environment-specific keys: `STRIPE_SECRET_KEY_DEV` vs `STRIPE_SECRET_KEY_PROD`

**DynamoDB Pattern**
- Helper functions in `lib/services/lambda/helpers/dynamo-helpers/` for CRUD operations
- Table definitions in `lib/services/dynamodb/ddb-table-definitions.ts`
- Key tables: users, products, organizations, payment_methods, promotions

**Lambda Function Organization**
- Handlers in `lib/services/lambda/handlers/` grouped by domain (auth, payments, organizations)
- Helper functions in `lib/services/lambda/helpers/` for reusable logic
- Default Lambda configuration in `lambda-defaults.ts`
- API Gateway integration with Cognito authorization

### Product Manager Development Server

The `product-server.ts` provides a local Express server for product and promotion management during development:
- CRUD operations for products with Stripe synchronization
- Promotional code management
- Usage meter management
- Environment-based configuration (.env.local files)

### Code Style Requirements

- **No semicolons** (ESLint rule: `'semi': ['error', 'never']`)
- **2-space indentation**
- **Multiline formatting** for objects/arrays with 2+ items
- **TypeScript strict mode** enabled
- Tests use Jest with ts-jest transformer

### Environment Configuration

Environment variables are set per deployment:
- `USER_POOL_CLIENT_ID` and `USER_POOL_ID` from Cognito stack
- `STRIPE_SECRET_KEY` and `STRIPE_EVENT_DESTINATION` (dev/prod variants)
- Local development requires `.env.local` and `.env.local.production` files

### NOTES
DO NOT USE THE FOLLOWING COMMANDS
- yarn build
- yarn lint
- yarn test