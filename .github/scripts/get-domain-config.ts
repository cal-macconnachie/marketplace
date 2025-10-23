#!/usr/bin/env tsx

/**
 * Utility script to extract domain configuration from @marketplace/constants
 * This ensures the CI/CD workflow stays in sync with the constants package by
 * actually importing the domain constant rather than hardcoding it.
 *
 * Usage:
 *   npx tsx .github/scripts/get-domain-config.ts --env=dev
 *   npx tsx .github/scripts/get-domain-config.ts --env=prod
 *
 * The script outputs shell variables that can be eval'd:
 *   eval "$(npx tsx .github/scripts/get-domain-config.ts --env=dev)"
 */

// Get environment from CLI args
const envArg = process.argv.find(arg => arg.startsWith('--env='));
const envName = envArg ? envArg.split('=')[1] : 'dev';

// Set ENV_NAME so the constants package evaluates correctly
process.env.ENV_NAME = envName;

// Import domain from the constants package - this is the single source of truth
import('@marketplace/constants').then(({ domain }) => {
  // SSM parameter name uses dashes instead of dots (matching marketplace-infrastructure-stack.ts:103)
  const bucketParamName = `/marketplace/${envName}/s3/${domain.replace(/\./g, '-')}`;

  // Output as shell variables that can be sourced
  console.log(`DOMAIN="${domain}"`);
  console.log(`BUCKET_PARAM_NAME="${bucketParamName}"`);
}).catch(err => {
  console.error('Failed to load domain from @marketplace/constants:', err);
  process.exit(1);
});
