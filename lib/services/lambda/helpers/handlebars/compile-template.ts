
import Handlebars from 'handlebars'
import fs from 'node:fs'

export const compileTemplate = ({
  templatePath, context
}: {
  templatePath: string,
  context: unknown
}) => {
  const templateSrc = fs.readFileSync(templatePath, 'utf8')
  const compile = Handlebars.compile(templateSrc)
  return compile(context)
}
