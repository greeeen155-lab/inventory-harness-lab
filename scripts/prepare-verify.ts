import { existsSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import 'dotenv/config'

const url = process.env.VERIFY_DATABASE_URL ?? 'file:./prisma/verify.db'
if (!url.startsWith('file:')) {
  throw new Error(`검증 준비는 SQLite file URL만 지원합니다: ${url}`)
}

const dbPath = path.resolve(process.cwd(), url.replace(/^file:/, ''))
const files = [dbPath, `${dbPath}-journal`, `${dbPath}-wal`, `${dbPath}-shm`]

console.log(`\n▸ 검증용 데이터베이스를 초기화합니다: ${dbPath}\n`)
for (const file of files) {
  if (existsSync(file)) rmSync(file, { force: true })
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
execFileSync(npm, ['run', 'db:ensure'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, DATABASE_URL: url },
})
console.log('\n▸ 검증용 데이터베이스 준비 완료\n')
