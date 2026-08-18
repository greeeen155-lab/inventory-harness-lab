import { describe, expect, it } from 'vitest'
import { ALLOCATION, planAllocation, planFefo } from '@/lib/fefo'

const lot = (id: number, ymd: string, quantity: number) => ({
  id,
  expiryDate: new Date(ymd),
  quantity,
})

describe('FEFO 배분', () => {
  it('유통기한이 빠른 로트부터 나간다', () => {
    const { plan } = planFefo([lot(1, '2027-03-31', 50), lot(2, '2026-09-10', 15)], 10)
    expect(plan).toHaveLength(1)
    expect(plan[0].lotId).toBe(2) // 임박한 쪽
    expect(plan[0].qty).toBe(10)
  })

  it('수량이 여러 로트에 걸치면 임박 순으로 쪼갠다', () => {
    const { plan, shortage } = planFefo([lot(1, '2027-01-20', 50), lot(2, '2026-09-10', 15)], 20)
    expect(shortage).toBe(0)
    expect(plan.map((p) => [p.lotId, p.qty])).toEqual([
      [2, 15], // 임박분 전부
      [1, 5], // 나머지
    ])
  })

  it('재고가 모자라면 부족분을 알려준다', () => {
    const { plan, shortage } = planFefo([lot(1, '2026-09-10', 15)], 20)
    expect(shortage).toBe(5)
    expect(plan[0].qty).toBe(15)
  })

  it('만료된 로트도 후보에 포함한다 (실물이 아직 창고에 있으므로)', () => {
    const { plan } = planFefo([lot(1, '2027-03-31', 50), lot(2, '2020-01-01', 5)], 3)
    expect(plan[0].lotId).toBe(2)
  })

  it('수량 0인 로트는 건너뛴다', () => {
    const { plan } = planFefo([lot(1, '2026-01-01', 0), lot(2, '2027-03-31', 10)], 4)
    expect(plan).toHaveLength(1)
    expect(plan[0].lotId).toBe(2)
  })
})

describe('LEFO 배분 — 풀필먼트 발송', () => {
  it('유통기한이 늦은 로트부터 보낸다 (임박분은 자사창고에 남긴다)', () => {
    const { plan } = planAllocation(
      [lot(1, '2026-09-10', 18), lot(2, '2027-03-31', 60)],
      20,
      ALLOCATION.LEFO
    )
    expect(plan).toHaveLength(1)
    expect(plan[0].lotId).toBe(2) // 기한이 넉넉한 쪽
    expect(plan[0].qty).toBe(20)
  })

  it('넉넉한 재고가 모자랄 때만 임박분이 섞인다', () => {
    const { plan, shortage } = planAllocation(
      [lot(1, '2026-09-10', 18), lot(2, '2027-03-31', 10)],
      25,
      ALLOCATION.LEFO
    )
    expect(shortage).toBe(0)
    expect(plan.map((p) => [p.lotId, p.qty])).toEqual([
      [2, 10], // 넉넉한 것 먼저 전부
      [1, 15], // 부족분만 임박분에서
    ])
  })

  it('같은 재고라도 출고(FEFO)와 발송(LEFO)은 정반대로 고른다', () => {
    const lots = [lot(1, '2026-09-10', 18), lot(2, '2027-03-31', 60)]
    const out = planAllocation(lots, 10, ALLOCATION.FEFO)
    const send = planAllocation(lots, 10, ALLOCATION.LEFO)
    expect(out.plan[0].lotId).toBe(1) // 출고: 임박분
    expect(send.plan[0].lotId).toBe(2) // 발송: 넉넉한 분
  })
})
