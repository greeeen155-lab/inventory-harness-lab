import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '@/generated/prisma/client'

/**
 * PrismaClient 싱글턴.
 * Prisma 7은 드라이버 어댑터를 통해 SQLite에 접속한다.
 * WAL 모드로 열어 읽기와 쓰기가 서로 막지 않게 한다.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createClient() {
  const url = process.env.DATABASE_URL ?? 'file:./prisma/dev.db'
  const adapter = new PrismaBetterSqlite3({ url })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
