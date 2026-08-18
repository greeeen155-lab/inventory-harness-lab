/**
 * 첫 실행 자동 준비.
 *
 * dev.db 파일이 없으면 마이그레이션과 시드를 알아서 돌린다.
 * 수강생은 `git clone → npm install → npm run dev` 세 줄이면 된다.
 * (DB 파일은 커밋하지 않는다 — 바이너리라 병합이 안 되고, 스키마가 어긋난다)
 */
import { existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import 'dotenv/config'

const url = process.env.DATABASE_URL ?? 'file:./prisma/dev.db'
const dbPath = path.resolve(process.cwd(), url.replace(/^file:/, ''))

const run = (cmd: string) => execSync(cmd, { stdio: 'inherit' })

if (existsSync(dbPath)) {
  process.exit(0)
}

console.log('\n▸ 데이터베이스가 없어 새로 만듭니다 (최초 1회)\n')
run('npx prisma migrate deploy')
run('npx prisma generate')
run('npx tsx prisma/seed.ts')
console.log('\n▸ 준비 완료. 로그인: warehouse@demo.kr / demo1234\n')
