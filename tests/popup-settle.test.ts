import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db, totalStock } from './helpers'
import { applyMovement } from '@/lib/stock'
import { settlePopupTx, tallyPopup, unsettlePopupTx } from '@/lib/popup'
import { dateOnly, today, addDays } from '@/lib/date'

/**
 * 팝업 정산 — 시연용 시드(성수 팝업)는 건드리지 않고 테스트 전용 팝업을 만들어 쓴다.
 * 앞뒤로 자기가 만든 것만 지운다.
 */
const NAME = '__테스트 팝업'
const EXPIRY_SOON = dateOnly(addDays(today(), 30)) // 임박분 — 시식은 여기서 먼저 빠져야 한다
const EXPIRY_LATE = dateOnly(addDays(today(), 500))

async function cleanup() {
  const popup = await db.popup.findFirst({ where: { name: NAME } })
  if (popup) {
    await db.movement.deleteMany({ where: { popupId: popup.id } })
    await db.popupPlan.deleteMany({ where: { popupId: popup.id } })
    await db.popup.delete({ where: { id: popup.id } })
    await db.lot.deleteMany({ where: { locationId: popup.locationId } })
    await db.location.delete({ where: { id: popup.locationId } })
  }
  await db.movement.deleteMany({ where: { expiryDate: { in: [EXPIRY_SOON, EXPIRY_LATE] } } })
  await db.lot.deleteMany({ where: { expiryDate: { in: [EXPIRY_SOON, EXPIRY_LATE] } } })
}

async function fixture() {
  const [own, user, product] = await Promise.all([
    db.location.findFirstOrThrow({ where: { type: 'OWN' } }),
    db.user.findFirstOrThrow(),
    db.product.findFirstOrThrow({ where: { sku: 'DOG-CHEESE-200' } }),
  ])
  const location = await db.location.create({ data: { name: NAME, type: 'POPUP' } })
  const popup = await db.popup.create({
    data: {
      name: NAME,
      status: 'ACTIVE',
      startDate: today(),
      endDate: addDays(today(), 3),
      locationId: location.id,
      sourceLocationId: own.id,
    },
  })

  // 자사창고 입고 → 팝업으로 두 번 반출 (1차 120 + 2차 40 = 누적 160)
  await db.$transaction(async (tx) => {
    for (const [expiry, qty] of [
      [EXPIRY_SOON, 60],
      [EXPIRY_LATE, 100],
    ] as const) {
      await applyMovement(tx, {
        type: 'INBOUND',
        reason: 'PURCHASE',
        productId: product.id,
        expiryDate: expiry,
        quantity: qty,
        toLocationId: own.id,
        userId: user.id,
      })
    }
    // 1차 반출 120 (임박 60 + 넉넉 60), 2차 추가 반출 40
    for (const [expiry, qty] of [
      [EXPIRY_SOON, 60],
      [EXPIRY_LATE, 60],
      [EXPIRY_LATE, 40],
    ] as const) {
      await applyMovement(tx, {
        type: 'POPUP_OUT',
        productId: product.id,
        expiryDate: expiry,
        quantity: qty,
        fromLocationId: own.id,
        toLocationId: location.id,
        popupId: popup.id,
        userId: user.id,
      })
    }
  })

  const lots = await db.lot.findMany({
    where: { locationId: location.id },
    orderBy: { expiryDate: 'asc' },
  })
  return { own, user, product, location, popup, lots }
}

describe('팝업 정산', () => {
  beforeAll(cleanup)
  afterAll(async () => {
    await cleanup()
    await db.$disconnect()
  })

  it('누적 반출 기준으로 판매를 역산한다 (1차 + 추가 반출)', async () => {
    const { user, popup, location, lots, own, product } = await fixture()

    const totals = tallyPopup(
      await db.movement.findMany({ where: { popupId: popup.id } }),
      location.id
    )
    expect(totals.shipped).toBe(160) // 1차 120 + 2차 40

    const beforeTotal = await totalStock()
    const soonLot = lots.find((l) => l.expiryDate.getTime() === EXPIRY_SOON.getTime())!
    const lateLot = lots.find((l) => l.expiryDate.getTime() === EXPIRY_LATE.getTime())!

    // 잔여 42 (임박 2 + 넉넉 40) · 시식 5 → 차감 118 → 판매 113
    const settled = await db.$transaction((tx) =>
      settlePopupTx(tx, {
        popupId: popup.id,
        userId: user.id,
        returns: [
          { lotId: soonLot.id, qty: 2 },
          { lotId: lateLot.id, qty: 40 },
        ],
        samples: [{ productId: product.id, qty: 5 }],
      })
    )

    expect(settled.returned).toBe(42)
    expect(settled.sample).toBe(5)
    expect(settled.sold).toBe(113) // ★ 160 − 42 − 5

    // 팝업 거점은 비고, 잔여는 유통기한 그대로 자사창고로 돌아온다
    const popupLeft = await db.lot.aggregate({
      _sum: { quantity: true },
      where: { locationId: location.id },
    })
    expect(popupLeft._sum.quantity).toBe(0)
    expect(
      (
        await db.lot.findUnique({
          where: {
            productId_locationId_expiryDate: {
              productId: product.id,
              locationId: own.id,
              expiryDate: EXPIRY_SOON,
            },
          },
        })
      )?.quantity
    ).toBe(2)

    // 118개가 외부로 나갔으므로 총 재고는 그만큼만 줄어든다
    expect(await totalStock()).toBe(beforeTotal - 118)

    const closed = await db.popup.findUniqueOrThrow({ where: { id: popup.id } })
    expect(closed.status).toBe('CLOSED')
  })

  it('시식·증정은 임박한 로트부터 나간 것으로 본다 (FEFO)', async () => {
    const { popup, product } = await db.popup
      .findFirstOrThrow({ where: { name: NAME } })
      .then(async (p) => ({
        popup: p,
        product: await db.product.findFirstOrThrow({ where: { sku: 'DOG-CHEESE-200' } }),
      }))

    const samples = await db.movement.findMany({
      where: { popupId: popup.id, reason: 'SAMPLE', productId: product.id },
    })
    expect(samples).toHaveLength(1)
    expect(samples[0].expiryDate.getTime()).toBe(EXPIRY_SOON.getTime())
    expect(samples[0].quantity).toBe(5)
  })

  it('정산을 되돌리면 재고가 팝업으로 돌아온다 (상쇄 기록)', async () => {
    const popup = await db.popup.findFirstOrThrow({ where: { name: NAME } })
    const user = await db.user.findFirstOrThrow()
    const beforeTotal = await totalStock()

    await db.$transaction((tx) => unsettlePopupTx(tx, popup.id, user.id))

    const back = await db.lot.aggregate({
      _sum: { quantity: true },
      where: { locationId: popup.locationId },
    })
    expect(back._sum.quantity).toBe(160) // 누적 반출 그대로
    expect(await totalStock()).toBe(beforeTotal + 118) // 외부로 나갔던 만큼 되돌아온다
    expect((await db.popup.findUniqueOrThrow({ where: { id: popup.id } })).status).toBe('ACTIVE')

    const reversals = await db.movement.findMany({
      where: { popupId: popup.id, reversalOfId: { not: null } },
    })
    expect(reversals.length).toBeGreaterThan(0) // 삭제가 아니라 상쇄
  })

  it('시식 수량이 차감분보다 크면 저장되지 않는다', async () => {
    const popup = await db.popup.findFirstOrThrow({ where: { name: NAME } })
    const user = await db.user.findFirstOrThrow()
    const product = await db.product.findFirstOrThrow({ where: { sku: 'DOG-CHEESE-200' } })
    const lots = await db.lot.findMany({ where: { locationId: popup.locationId } })
    const before = await totalStock()

    await expect(
      db.$transaction((tx) =>
        settlePopupTx(tx, {
          popupId: popup.id,
          userId: user.id,
          // 전량 복귀 = 차감 0인데 시식 1개를 넣었다
          returns: lots.map((l) => ({ lotId: l.id, qty: l.quantity })),
          samples: [{ productId: product.id, qty: 1 }],
        })
      )
    ).rejects.toThrow('시식·증정 수량이 차감분보다 클 수 없습니다')

    expect(await totalStock()).toBe(before) // 아무것도 바뀌지 않는다
    expect((await db.popup.findUniqueOrThrow({ where: { id: popup.id } })).status).toBe('ACTIVE')
  })

  it('반출한 것보다 많이 돌아올 수 없다', async () => {
    const popup = await db.popup.findFirstOrThrow({ where: { name: NAME } })
    const user = await db.user.findFirstOrThrow()
    const lot = await db.lot.findFirstOrThrow({ where: { locationId: popup.locationId } })

    await expect(
      db.$transaction((tx) =>
        settlePopupTx(tx, {
          popupId: popup.id,
          userId: user.id,
          returns: [{ lotId: lot.id, qty: lot.quantity + 1 }],
          samples: [],
        })
      )
    ).rejects.toThrow('반출한 수량보다 많이')
  })
})
