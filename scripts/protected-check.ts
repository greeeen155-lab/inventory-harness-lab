import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ssotPath = path.resolve(process.cwd(), 'docs/harness/00-ssot.md')
const ssot = readFileSync(ssotPath, 'utf8')
const match = ssot.match(
  /<!-- protected-paths:start -->([\s\S]*?)<!-- protected-paths:end -->/,
)

if (!match) {
  throw new Error('SSOT에 보호 경로 목록이 없습니다')
}

const protectedPaths = match[1]
  .split('\n')
  .map((line) => line.match(/^\s*-\s+`([^`]+)`\s*$/)?.[1])
  .filter((value): value is string => Boolean(value))
  .map((value) => value.replace(/\\/g, '/').replace(/\/$/, ''))

if (protectedPaths.length === 0) {
  throw new Error('SSOT의 보호 경로 목록이 비어 있습니다')
}

const runGit = (...args: string[]) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })

const base = process.env.GITHUB_BASE_SHA ?? process.env.BASE_SHA
const changed = new Set(
  (base
    ? runGit('diff', '--name-only', `${base}...HEAD`)
    : runGit('diff', '--name-only', 'HEAD'))
    .split(/\r?\n/)
    .map((file) => file.trim().replace(/\\/g, '/'))
    .filter(Boolean),
)

for (const line of runGit('status', '--porcelain=v1').split(/\r?\n/)) {
  const file = line.slice(3).trim().replace(/\\/g, '/')
  if (file) changed.add(file)
}

const protectedChanges = [...changed].filter((file) =>
  protectedPaths.some((protectedPath) => file === protectedPath || file.startsWith(`${protectedPath}/`)),
)

if (protectedChanges.length === 0) {
  console.log('Protected check passed: no protected paths changed')
  process.exit(0)
}

const approved = ['1', 'true', 'yes'].includes(
  (process.env.PROTECTED_APPROVED ?? '').toLowerCase(),
)
const approver = process.env.PROTECTED_APPROVER?.trim()

if (!approved || !approver) {
  console.error('Protected check failed: protected paths changed without human approval')
  for (const file of protectedChanges) console.error(`  ${file}`)
  console.error('  status: NEEDS_HUMAN')
  console.error('  approval: set PROTECTED_APPROVED=1 and PROTECTED_APPROVER=<human>')
  process.exit(1)
}

console.log(`Protected check passed: human approval by ${approver}`)
for (const file of protectedChanges) console.log(`  approved: ${file}`)
