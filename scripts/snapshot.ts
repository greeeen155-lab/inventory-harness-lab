/** 거점별 재고 스냅샷 — 이동 전후로 총량이 유지되는지 확인용 */
import 'dotenv/config'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../src/generated/prisma/client'

const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db' }),
})

async function main() {
  const locs = await db.location.findMany({ include: { lots: { where: { quantity: { gt: 0 } } } } })
  let total = 0
  for (const l of locs) {
    const sum = l.lots.reduce((s, x) => s + x.quantity, 0)
    total += sum
    if (sum > 0) console.log(`  ${l.name.padEnd(12)} ${String(sum).padStart(6)}`)
  }
  console.log(`  ${'총 재고'.padEnd(11)} ${String(total).padStart(6)}`)
}
main().finally(() => db.$disconnect())
