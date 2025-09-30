#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import * as path from 'path';

interface Args {
  functionName?: string;
  environment: 'dev' | 'prod';
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let functionName: string | undefined;
  let environment: 'dev' | 'prod' = 'dev';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-f' && args[i + 1]) {
      functionName = args[i + 1];
      i++;
    } else if (args[i] === '-e' && args[i + 1]) {
      const env = args[i + 1];
      if (env !== 'dev' && env !== 'prod') {
        console.error('Error: -e must be either "dev" or "prod"');
        process.exit(1);
      }
      environment = env;
      i++;
    }
  }

  if (!functionName) {
    console.error('Error: -f flag with function name is required');
    console.error('Usage: yarn deploy-lambda -f <function-name> [-e <dev|prod>]');
    process.exit(1);
  }

  return { functionName, environment };
}

function main() {
  const { functionName, environment } = parseArgs();

  console.log(`Deploying function: ${functionName} to environment: ${environment}`);

  // Construct the Lambda function name with environment suffix
  const fullFunctionName = `${functionName}-${environment}`;

  try {
    // Build TypeScript
    console.log('\n📦 Building TypeScript...');
    execSync('yarn build', { stdio: 'inherit' });

    // Deploy the specific Lambda function using CDK
    console.log(`\n🚀 Deploying Lambda function: ${fullFunctionName}...`);
    const cdkCommand = `cdk deploy --exclusively "*/${fullFunctionName}" --require-approval never`;

    execSync(cdkCommand, {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..')
    });

    console.log(`\n✅ Successfully deployed ${fullFunctionName}`);
  } catch (error) {
    console.error(`\n❌ Deployment failed for ${fullFunctionName}`);
    process.exit(1);
  }
}

main();
