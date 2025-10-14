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
  // Convert paths to regex pattern parts, matching any file with this prefix
  // 'handlers/auth/login' -> 'handlers/auth/login' (will match .ts, .js, etc.)
  // Escape special regex characters and group
  const escapedPaths = paths.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  // Add optional file extension and any subdirectories
  return `(${escapedPaths.map(p => `${p}(\\.[^/]+)?`).join('|')})`
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
    const allPaths = [
      ...stack.handlers,
      ...stack.templates,
    ]

    // Add the endpoint definition file itself, the stack file, and helpers
    // Make pattern more inclusive - match any file in handler/template paths
    const pattern = `^backend/lib/(marketplace-${stackName}-stack|services/lambda/(endpoint-definitions/${stackName}-endpoints|${generateRegexPattern(allPaths)}|helpers))`

    console.log(pattern)
  } else if (arg === '--bash-vars') {
    // Output bash variable assignments for all stacks
    for (const [
      stackName,
      stack
    ] of Object.entries(stackHandlers)) {
      const allPaths = [
        ...stack.handlers,
        ...stack.templates,
      ]

      const stackKey = stackName.toUpperCase().replace(/-/g, '_')
      const pattern = `^backend/lib/(marketplace-${stackName}-stack|services/lambda/(endpoint-definitions/${stackName}-endpoints|${generateRegexPattern(allPaths)}|helpers))`

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
