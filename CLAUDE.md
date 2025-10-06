# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Marketplace is a Yarn v4 monorepo containing a Vue 3 frontend and AWS CDK backend for a SaaS marketplace platform. The application enables organizations to sell and purchase products, with Stripe integration for payments and AWS Cognito for authentication.

## Repository Structure

- **Root**: Monorepo configuration with Yarn workspaces
- **backend/**: AWS CDK infrastructure and Lambda handlers (TypeScript)
- **frontend/**: Vue 3 + Vue Router + Pinia application (TypeScript)

Root-level `cdk.json`, `cdk.context.json`, and `jest.config.js` are legacy files and should be ignored - all CDK operations run from the `backend/` directory.

## Common Commands

### Root Level (Monorepo)
```bash
# Install all dependencies
yarn install:all

# Build everything
yarn build:all

# Lint everything
yarn lint:all
```

### Backend
```bash
# Navigate to backend or use workspace commands
yarn workspace marketplace-backend <command>

# Build TypeScript
yarn backend:build

# Run tests
yarn backend:test

# Lint
yarn backend:lint

# CDK operations (from backend/ directory)
cd backend && yarn cdk synth
cd backend && yarn cdk deploy --context envName=dev

# Clean compiled files
yarn workspace marketplace-backend clean
```

### Frontend
```bash
# Navigate to frontend or use workspace commands
yarn workspace marketplace-frontend <command>

# Development server
yarn frontend:dev

# Type check
yarn workspace marketplace-frontend type-check

# Build for production
yarn frontend:build

# Preview production build
yarn frontend:preview

# Lint and fix
yarn frontend:lint
```

## Architecture

### Backend (AWS CDK)

The backend uses a **two-stack architecture** to optimize deployment speed:

1. **MarketplaceInfrastructureStack** (`lib/marketplace-infrastructure-stack.ts`): Stable resources that rarely change:
   - DynamoDB tables (via `DdbTablesConstruct`)
   - Cognito User Pool and Client (via `CognitoStack`)
   - S3 buckets (via `S3Construct`)
   - Route53 hosted zones (via `Route53Construct`)
   - Exports outputs to SSM Parameter Store for loose coupling

2. **MarketplaceLambdaStack** (`lib/marketplace-lambda-stack.ts`): Frequently-changing resources:
   - Lambda functions (via `LambdaConstruct`)
   - CloudFront distributions (via `CloudFrontConstruct`)
   - Depends on InfrastructureStack outputs

**Entry point**: `bin/marketplace-backend.ts` creates both stacks with environment context (`envName`, defaults to 'dev').

**Service organization** (`lib/services/`):
- `cloudfront/`: CDN configuration and definitions
- `cognito/`: User authentication setup
- `dynamodb/`: Table definitions and stack
- `lambda/`: Function handlers, bundling configs, endpoint definitions, defaults
  - `handlers/`: Organized by domain (auth, organizations, payments, products, stripe, etc.)
- `route53/`: DNS zone configuration
- `s3/`: Bucket definitions and stack

**Lambda handlers** follow domain-driven organization:
- `auth/`: Authentication flows (login, register, refresh, password reset, OAuth)
- `organizations/`: Organization and user management
- `payments/`: Payment method CRUD, purchase flows
- `products/`: Product management
- `stripe/`: Stripe Connect, webhooks, meter events
- `images/`: Image upload with presigned URLs

### Frontend (Vue 3)

**Tech stack**: Vue 3 (Composition API), Vue Router, Pinia (state management), Vite, TypeScript

**Directory structure** (`frontend/src/`):
- `components/`: Vue components organized as pages (e.g., `DashboardPage.vue`, `MarketplacePage.vue`, `CartPage.vue`)
  - `ui/`: Reusable UI components
- `router/`: Route definitions with auth guards
- `services/`: API client (`api.ts`) with axios interceptors for token refresh
- `stores/`: Pinia stores (e.g., `app.ts` for auth state)
- `styles/`: Global styles
- `utils/`: Utility functions

**Authentication flow**:
- Cognito-based auth with JWT tokens stored in localStorage (`authToken`, `accessToken`, `refreshToken`)
- API interceptor automatically refreshes tokens on 401/403
- Router guard (`router/index.ts`) protects routes with `meta.requiresAuth`
- OAuth callback handled via `/auth/callback` route

**API client** (`services/api.ts`):
- Exports `authAPI` and `publicApi` namespaces with typed methods
- Base URL determined by `VITE_API_ENV` (dev vs prod)
- Comprehensive TypeScript interfaces for all entities (User, Organization, Product, Purchase, PaymentMethod, etc.)
- Axios interceptors for authorization and token refresh

## TypeScript Configuration

**Monorepo**: Root `tsconfig.json` uses project references to `backend/` and `frontend/`

**Backend**: `backend/tsconfig.json`
- Target: ES2022, Module: NodeNext
- Composite project for incremental builds
- Strict type checking enabled

**Frontend**: `frontend/tsconfig.json`
- Project references to `tsconfig.app.json` (app code) and `tsconfig.node.json` (Vite config)
- Vue 3 and TypeScript configured with `vue-tsc`

## Environment Variables

**Backend** (CDK deployment):
- `STRIPE_SECRET_KEY_DEV` / `STRIPE_SECRET_KEY_PROD`
- `STRIPE_EVENT_DESTINATION_DEV` / `STRIPE_EVENT_DESTINATION_PROD`
- `STRIPE_EVENT_DESTINATION_PLATFORM_DEV` / `STRIPE_EVENT_DESTINATION_PLATFORM_PROD`
- `EMAIL_AWS_REGION`, `EMAIL_LAMBDA_ARN`, `EMAIL_ASSUME_ROLE_ARN`

**Frontend** (Vite build):
- `VITE_API_ENV`: Determines API base URL (dev/prod)

## Key Patterns

- **CDK**: Service-based constructs in `lib/services/` promote modularity
- **Lambda**: Handlers use shared defaults from `lambda-defaults.ts` for bundling and configuration
- **Frontend**: Route-based code splitting with dynamic imports (`() => import(...)`)
- **API**: Centralized error handling and token management in axios interceptors
- **State**: Pinia stores for global state (auth, cart, etc.)

## Testing

- Backend: Jest with ts-jest transformer, tests in `test/` directory
- Frontend: Type checking with `vue-tsc`, linting with ESLint

## Deployment Context

CDK stacks use `envName` context parameter (defaults to 'dev') to namespace resources. Pass via `--context envName=<env>` to CDK commands.
