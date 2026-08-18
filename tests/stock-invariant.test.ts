import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db, ids, lotQty, totalStock } from './helpers'
import { applyMovement, InsufficientStockError, reverseMovement } from '@/lib/stock'
import { dateOnly, today, addDays } from '@/lib/date'

const EXPIRY = dateOnly(addDays(today(), 400))

async function cleanup() {
  await db.movement.deleteMany({ where: { expiryDate: EXPIRY } })
  await db.lot.deleteMany({ where: { expiryDate: EXPIRY } })
}

describe('재고 불변식', () => {
  // 몇 번을 돌려도 같은 결과가 나와야 한다 (앞뒤로 자기 흔적을 지운다)
  beforeAll(cleanup)
  // 테스트는 시연용 시드 데이터를 오염시키지 않는다 — 자기가 만든 것만 지운다
  afterAll(async () => {
    await cleanup()
    await db.$disconnect()
  })

  it('입고하면 총 재고가 그만큼 늘어난다 (외부 → 내부)', async () => {
    const { own, user, product } = await ids()
    const before = await totalStock()

    await db.$transaction((tx) =>
      applyMovement(tx, {
        type: 'INBOUND',
        reason: 'PURCHASE',
        productId: product.id,
        expiryDate: EXPIRY,
        quantity: 30,
        toLocationId: own.id,
        userId: user.id,
      })
    )

    expect(await totalStock()).toBe(before + 30)
    expect(await lotQty(product.id, own.id, EXPIRY)).toBe(30)
  })

  it('거점 간 이동은 총 재고를 바꾸지 않는다', async () => {
    const { own, ff, user, product } = await ids()
    const before = await totalStock()

    await db.$transaction((tx) =>
      applyMovement(tx, {
        type: 'TRANSFER',
        productId: product.id,
        expiryDate: EXPIRY,
        quantity: 10,
        fromLocationId: own.id,
        toLocationId: ff.id,
        userId: user.id,
      })
    )

    expect(await totalStock()).toBe(before) // ★ 재고는 사라지지 않는다
    expect(await lotQty(product.id, own.id, EXPIRY)).toBe(20)
    expect(await lotQty(product.id, ff.id, EXPIRY)).toBe(10)
  })

  it('보유보다 많이 출고하면 예외가 나고 아무것도 바뀌지 않는다', async () => {
    const { own, user, product } = await ids()
    const before = await totalStock()
    const beforeLot = await lotQty(product.id, own.id, EXPIRY)

    await expect(
      db.$transaction((tx) =>
        applyMovement(tx, {
          type: 'OUTBOUND',
          reason: 'SALE',
          productId: product.id,
          expiryDate: EXPIRY,
          quantity: beforeLot + 1,
          fromLocationId: own.id,
          userId: user.id,
        })
      )
    ).rejects.toBeInstanceOf(InsufficientStockError)

    expect(await totalStock()).toBe(before)
    expect(await lotQty(product.id, own.id, EXPIRY)).toBe(beforeLot)
  })

  it('취소하면 상쇄 기록이 생기고 수량이 원래대로 돌아온다', async () => {
    const { own, user, product } = await ids()
    const beforeLot = await lotQty(product.id, own.id, EXPIRY)

    const mv = await db.$transaction((tx) =>
      applyMovement(tx, {
        type: 'OUTBOUND',
        reason: 'SALE',
        productId: product.id,
        expiryDate: EXPIRY,
        quantity: 5,
        fromLocationId: own.id,
        userId: user.id,
      })
    )
    expect(await lotQty(product.id, own.id, EXPIRY)).toBe(beforeLot - 5)

    await db.$transaction((tx) => reverseMovement(tx, mv.id, user.id))

    expect(await lotQty(product.id, own.id, EXPIRY)).toBe(beforeLot) // 원복
    const reversal = await db.movement.findFirst({ where: { reversalOfId: mv.id } })
    expect(reversal).not.toBeNull() // 삭제가 아니라 상쇄 기록
  })

  it('같은 기록을 두 번 취소할 수 없다', async () => {
    const { own, user, product } = await ids()
    const mv = await db.$transaction((tx) =>
      applyMovement(tx, {
        type: 'OUTBOUND',
        reason: 'SALE',
        productId: product.id,
        expiryDate: EXPIRY,
        quantity: 3,
        fromLocationId: own.id,
        userId: user.id,
      })
    )
    await db.$transaction((tx) => reverseMovement(tx, mv.id, user.id))
    await expect(db.$transaction((tx) => reverseMovement(tx, mv.id, user.id))).rejects.toThrow(
      '이미 취소된',
    )
  })

  it('Lot 수량과 Movement 합계가 항상 일치한다', async () => {
    const lots = await db.lot.findMany()
    const movements = await db.movement.findMany()
    for (const lot of lots) {
      const inQty = movements
        .filter(
          (m) =>
            m.toLocationId === lot.locationId &&
            m.productId === lot.productId &&
            m.expiryDate.getTime() === lot.expiryDate.getTime()
        )
        .reduce((s, m) => s + m.quantity, 0)
      const outQty = movements
        .filter(
          (m) =>
            m.fromLocationId === lot.locationId &&
            m.productId === lot.productId &&
            m.expiryDate.getTime() === lot.expiryDate.getTime()
        )
        .reduce((s, m) => s + m.quantity, 0)
      expect(inQty - outQty).toBe(lot.quantity)
    }
  })
})
