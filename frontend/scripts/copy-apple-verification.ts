import { copyFileSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const env = process.env.VITE_API_ENV || 'dev'
const sourceFile = join(__dirname, '..', 'public', 'apple-verification', env, 'apple-developer-merchantid-domain-association.txt')
const destDir = join(__dirname, '..', 'public', '.well-known')
const destFileNoExt = join(destDir, 'apple-developer-merchantid-domain-association')
const destFileWithExt = join(destDir, 'apple-developer-merchantid-domain-association.txt')

// Create .well-known directory if it doesn't exist
mkdirSync(destDir, { recursive: true })

// Copy to both locations (with and without .txt extension)
copyFileSync(sourceFile, destFileNoExt)
copyFileSync(sourceFile, destFileWithExt)

console.log(`Copied ${env} Apple verification file to .well-known/ (both with and without .txt extension)`)
