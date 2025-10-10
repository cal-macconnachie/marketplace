
import Handlebars from 'handlebars'
import fs from 'node:fs'
import path from 'node:path'

export const compileTemplate = ({
  templatePath, context
}: {
  templatePath: string,
  context: unknown
}) => {
  // Resolve template path relative to the Lambda bundle root
  // In Lambda, __dirname is the bundled output directory (/var/task)
  // Templates are copied to the root of the bundle by the CDK bundling config
  const resolvedPath = path.isAbsolute(templatePath)
    ? templatePath
    : path.join(__dirname, templatePath)

  const templateSrc = fs.readFileSync(resolvedPath, 'utf8')
  const compile = Handlebars.compile(templateSrc)
  return compile(context)
}
