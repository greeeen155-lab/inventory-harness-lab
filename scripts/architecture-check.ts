import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = path.resolve(process.cwd(), 'src')
const allowedFile = path.normalize(path.join(root, 'lib', 'stock.ts'))
const models = new Set(['lot', 'movement'])
const mutations = new Set([
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
])

type Finding = {
  file: string
  line: number
  column: number
  model: string
  method: string
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const file = path.join(dir, entry)
    if (statSync(file).isDirectory()) return sourceFiles(file)
    return /\.(ts|tsx)$/.test(file) ? [file] : []
  })
}

function propertyName(node: ts.Expression): string | undefined {
  if (ts.isPropertyAccessExpression(node)) return node.name.text
  if (ts.isElementAccessExpression(node) && node.argumentExpression) {
    const argument = node.argumentExpression
    return ts.isStringLiteral(argument) ? argument.text : undefined
  }
  return undefined
}

function findMutations(file: string): Finding[] {
  if (path.normalize(file) === allowedFile) return []

  const source = readFileSync(file, 'utf8')
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const findings: Finding[] = []

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const method = propertyName(node.expression)
      const receiver = ts.isPropertyAccessExpression(node.expression)
        ? node.expression.expression
        : ts.isElementAccessExpression(node.expression)
          ? node.expression.expression
          : undefined
      const model = receiver ? propertyName(receiver) : undefined

      if (model && method && models.has(model) && mutations.has(method)) {
        const position = tree.getLineAndCharacterOfPosition(node.expression.getStart(tree))
        findings.push({
          file: path.relative(process.cwd(), file),
          line: position.line + 1,
          column: position.character + 1,
          model,
          method,
        })
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(tree)
  return findings
}

const findings = sourceFiles(root).flatMap(findMutations)

if (findings.length > 0) {
  console.error('Architecture check failed: direct Lot/Movement mutations are only allowed in src/lib/stock.ts')
  for (const finding of findings) {
    console.error(
      `  ${finding.file}:${finding.line}:${finding.column} ${finding.model}.${finding.method}() — use applyMovement() or reverseMovement()`,
    )
  }
  process.exit(1)
}

console.log('Architecture check passed: no direct Lot/Movement mutations outside src/lib/stock.ts')
