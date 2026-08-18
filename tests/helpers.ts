import 'dotenv/config'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../src/generated/prisma/client'

export const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db' }),
})

/** 총 재고 합계 — 내부 이동으로는 절대 변하지 않아야 한다 */
export async function totalStock() {
  const agg = await db.lot.aggregate({ _sum: { quantity: true } })
  return agg._sum.quantity ?? 0
}

export async function lotQty(productId: number, locationId: number, expiryDate: Date) {
  const lot = await db.lot.findUnique({
    where: { productId_locationId_expiryDate: { productId, locationId, expiryDate } },
  })
  return lot?.quantity ?? 0
}

export async function ids() {
  const [own, ff, user, product] = await Promise.all([
    db.location.findFirstOrThrow({ where: { type: 'OWN' } }),
    db.location.findFirstOrThrow({ where: { type: 'FULFILLMENT' } }),
    db.user.findFirstOrThrow(),
    db.product.findFirstOrThrow({ where: { sku: 'DOG-CHEESE-200' } }),
  ])
  return { own, ff, user, product }
}
