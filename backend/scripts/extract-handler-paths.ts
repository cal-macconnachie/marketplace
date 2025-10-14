#!/usr/bin/env ts-node
/**
 * Extract handler file paths from endpoint definitions
 * Used by CI/CD to dynamically determine which stack changed
 */

import * as fs from 'fs'
import * as path from 'path'

interface StackHandlers {
  [stackName: string]: {
    endpointFile: string
    handlers: string[]
    templates: string[]
  }
}

function getEndpointFiles(): Record<string, string> {
  const endpointDefinitionsDir = path.resolve(__dirname, '../lib/services/lambda/endpoint-definitions')
  const files = fs.readdirSync(endpointDefinitionsDir)

  const endpointFiles: Record<string, string> = {}

  for (const file of files) {
    if (file.endsWith('-endpoints.ts')) {
      // Extract stack name from filename: 'public-endpoints.ts' -> 'public'
      const stackName = file.replace('-endpoints.ts', '')
      endpointFiles[stackName] = `../lib/services/lambda/endpoint-definitions/${file}`
    }
  }

  return endpointFiles
}

function extractHandlerPaths(endpointFilePath: string): {
  handlers: string[]
  templates: string[]
} {
  const fullPath = path.resolve(__dirname, endpointFilePath)

  // Dynamic import would be better but requires async, so we'll parse the file
  const content = fs.readFileSync(fullPath, 'utf-8')

  const handlers: string[] = []
  const templates: string[] = []

  // Extract handler strings using regex
  // Matches: handler: 'some/path.functionName'
  const handlerRegex = /handler:\s*['"]([^'"]+)['"]/g
  let match

  while ((match = handlerRegex.exec(content)) !== null) {
    // Convert handler path to file path
    // 'auth/login.login' -> 'auth/login'
    const handlerPath = match[1].split('.')[0]
    handlers.push(`handlers/${handlerPath}`)
  }

  // Extract bundleTemplate strings
  // Matches: bundleTemplate: ['template.hbs']
  const templateRegex = /bundleTemplate:\s*\[([^\]]+)\]/g
  while ((match = templateRegex.exec(content)) !== null) {
    const templateMatches = match[1].match(/['"]([^'"]+)['"]/g)
    if (templateMatches) {
      templateMatches.forEach((t) => {
        const templateName = t.replace(/['"]/g, '')
        templates.push(`templates/${templateName}`)
      })
    }
  }

  return {
    handlers,
    templates,
  }
}

function generateRegexPattern(paths: string[]): string {
  // Simplified: match if path contains any of these strings
  // Much more robust - any file containing these paths will trigger
  // 'handlers/auth/login' will match 'backend/lib/services/lambda/handlers/auth/login.ts'
  const escapedPaths = paths.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return escapedPaths.join('|')
}

function main() {
  const stackHandlers: StackHandlers = {}
  const endpointFiles = getEndpointFiles()

  for (const [
    stackName,
    endpointFile
  ] of Object.entries(endpointFiles)) {
    const {
      handlers, templates 
    } = extractHandlerPaths(endpointFile)
    stackHandlers[stackName] = {
      endpointFile: endpointFile.replace('../', ''),
      handlers,
      templates,
    }
  }

  // Output format based on command line argument
  const arg = process.argv[2]

  if (arg === '--json') {
    console.log(JSON.stringify(stackHandlers, null, 2))
  } else if (arg && arg.startsWith('--stack=')) {
    const stackName = arg.replace('--stack=', '')
    const stack = stackHandlers[stackName]

    if (!stack) {
      console.error(`Unknown stack: ${stackName}`)
      process.exit(1)
    }

    // Output grep-compatible regex pattern for the stack
    // Simplified approach: match if file path contains ANY relevant substring
    const allPaths = [
      `marketplace-${stackName}-stack`,           // Stack definition file
      `${stackName}-endpoints`,                    // Endpoint definition file
      ...stack.handlers,                          // Handler files
      ...stack.templates,                         // Template files
      'services/lambda/helpers',                  // Shared helpers
      'services/lambda/domain-lambda-construct',  // Shared construct
      'services/lambda/bundling-configs',         // Shared bundling
      'services/lambda/lambda-defaults',          // Shared defaults
    ]

    const pattern = generateRegexPattern(allPaths)
    console.log(pattern)
  } else if (arg === '--bash-vars') {
    // Output bash variable assignments for all stacks
    for (const [
      stackName,
      stack
    ] of Object.entries(stackHandlers)) {
      // Simplified: match if file contains any relevant substring
      const allPaths = [
        `marketplace-${stackName}-stack`,
        `${stackName}-endpoints`,
        ...stack.handlers,
        ...stack.templates,
        'services/lambda/helpers',
        'services/lambda/domain-lambda-construct',
        'services/lambda/bundling-configs',
        'services/lambda/lambda-defaults',
      ]

      const stackKey = stackName.toUpperCase().replace(/-/g, '_')
      const pattern = generateRegexPattern(allPaths)
      console.log(`${stackKey}_PATTERN="${pattern}"`)
    }
  } else {
    console.error('Usage:')
    console.error('  extract-handler-paths.ts --json                 # Output full JSON')
    console.error('  extract-handler-paths.ts --stack=<name>         # Output grep pattern for stack')
    console.error('  extract-handler-paths.ts --bash-vars            # Output bash variables for all stacks')
    process.exit(1)
  }
}

main()
