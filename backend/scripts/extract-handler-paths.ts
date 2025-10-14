#!/usr/bin/env ts-node
/**
 * Extract handler file paths from endpoint definitions (TypeScript, typed, no fallbacks)
 * Emits grep-compatible patterns per stack.
 */

import * as fs from 'fs'
import * as path from 'path'

type StackInfo = {
  handlers: string[]
  templates: string[]
}

function resolveEndpointsDir(): string {
  // Support running from ts-node (__dirname = backend/scripts)
  // and from compiled JS (__dirname = backend/scripts/dist)
  const candidates = [
    path.resolve(__dirname, '../lib/services/lambda/endpoint-definitions'),
    path.resolve(__dirname, '../../lib/services/lambda/endpoint-definitions'),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return candidates[0]
}

function getEndpointFiles(): Record<string, string> {
  const dir = resolveEndpointsDir()
  const out: Record<string, string> = {}
  const files = fs.readdirSync(dir)
  for (const f of files) {
    if (f.endsWith('-endpoints.ts')) {
      const stack = f.replace('-endpoints.ts', '')
      out[stack] = path.join(dir, f)
    }
  }
  return out
}

function extractFromFile(fullPath: string): StackInfo {
  const content = fs.readFileSync(fullPath, 'utf-8')
  const handlers: string[] = []
  const templates: string[] = []

  // handler: 'foo/bar.baz' -> handlers/foo/bar
  const handlerRegex = /handler:\s*['"]([^'\"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = handlerRegex.exec(content)) !== null) {
    const handlerPath = m[1].split('.')[0]
    handlers.push(`handlers/${handlerPath}`)
  }

  // bundleTemplate: ['a.hbs', 'b.hbs'] -> templates/a.hbs, templates/b.hbs
  const templateBlock = /bundleTemplate:\s*\[([^\]]*)\]/g
  while ((m = templateBlock.exec(content)) !== null) {
    const inner = m[1]
    const items = inner.match(/['"][^'"]+['"]/g) || []
    for (const s of items) {
      const name = s.replace(/['"]/g, '')
      templates.push(`templates/${name}`)
    }
  }

  return {
    handlers, templates 
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function patternForStack(stack: string, info: StackInfo): string {
  const all = [
    `marketplace-${stack}-stack`,
    `${stack}-endpoints`,
    ...info.handlers,
    ...info.templates,
    'services/lambda/helpers',
    'services/lambda/domain-lambda-construct',
    'services/lambda/bundling-configs',
    'services/lambda/lambda-defaults',
  ]
  return all.map(escapeRegex).join('|')
}

function main() {
  const files = getEndpointFiles()
  const mapping: Record<string, StackInfo> = {}
  for (const [
    stack,
    file
  ] of Object.entries(files)) {
    mapping[stack] = extractFromFile(file)
  }

  const arg = process.argv[2] || ''
  if (arg === '--json') {
    console.log(JSON.stringify(mapping, null, 2))
    return
  }
  if (arg.startsWith('--stack=')) {
    const name = arg.replace('--stack=', '')
    const info = mapping[name]
    if (!info) {
      console.log('')
      return
    }
    console.log(patternForStack(name, info))
    return
  }
  // default: bash vars for all
  for (const [
    stack,
    info
  ] of Object.entries(mapping)) {
    const key = stack.toUpperCase().replace(/-/g, '_')
    const pattern = patternForStack(stack, info)
    console.log(`${key}_PATTERN="${pattern}"`)
  }
}

main()
