'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireUser, SessionExpiredError } from '@/lib/auth'
import { applyMovement, InsufficientStockError } from '@/lib/stock'
import { ALLOCATION, allocateLots } from '@/lib/fefo'
import { LOCATION_TYPES, MOVEMENT_TYPES, REASON_CODES } from '@/lib/constants'
import type { SaveResult } from './inbound'

/**
 * 풀필먼트 일일 반영 (S5) — 이 앱에서 가장 자주 쓰는 저장이다. 매일 3사 × 1회.
 *
 * 풀필먼트에 들어간 물건은 이후 고객 주문으로 계속 나간다.
 * MVP는 API 연동을 하지 않으므로 저쪽 관리자 페이지의 어제 출고 수량을 옮겨 적는다.
 * 로트는 사용자가 고르지 않는다 — 이미 고객에게 나간 물량이므로 FEFO로 차감한다.
 *
 * 입력이 하나도 없어도 저장할 수 있다. '어제 출고 0건'도 확인한 것이고,
 * 그래야 마지막 반영일이 갱신되어 홈의 할 일에서 사라진다.
 */
export async function saveFulfillmentReflection(input: {
  locationId: number
  lines: { productId: number; qty: number }[]
}): Promise<SaveResult> {
  let user
  try {
    user = await requireUser()
  } catch (e) {
    if (e instanceof SessionExpiredError) return { ok: false, error: e.message }
    throw e
  }

  const location = await db.location.findUnique({ where: { id: input.locationId } })
  if (!location || location.type !== LOCATION_TYPES.FULFILLMENT)
    return { ok: false, error: '풀필먼트 거점이 아닙니다' }

  const lines = input.lines.filter((l) => l.qty > 0)
  if (lines.some((l) => !Number.isInteger(l.qty)))
    return { ok: false, error: '수량은 정수로 입력하세요' }

  try {
    await db.$transaction(async (tx) => {
      for (const line of lines) {
        // 저장 직전 DB의 현재 재고로 다시 계산한다 (미리보기 이후 재고가 변했을 수 있다)
        const plan = await allocateLots(tx, {
          productId: line.productId,
          locationId: input.locationId,
          quantity: line.qty,
          strategy: ALLOCATION.FEFO,
        })

        for (const a of plan) {
          await applyMovement(tx, {
            type: MOVEMENT_TYPES.OUTBOUND,
            reason: REASON_CODES.SALE, // 풀필먼트에서 고객에게 나간 것 = 판매
            note: '풀필먼트 일일 반영', // 이력에서 일일 반영분만 골라 보기 위한 표식
            productId: line.productId,
            expiryDate: a.expiryDate,
            quantity: a.qty,
            fromLocationId: input.locationId, // 외부로 나간다 (to = null)
            userId: user.id,
          })
        }
      }

      // ★ 반영일 갱신 — 이 날짜가 곧 이 거점 숫자의 신뢰도다 (P6)
      await tx.location.update({
        where: { id: input.locationId },
        data: { lastReflectedAt: new Date() },
      })
    })
  } catch (e) {
    if (e instanceof InsufficientStockError) {
      const product = await db.product.findUnique({ where: { id: e.detail.productId } })
      return {
        ok: false,
        error: `${product?.name ?? '상품'} 재고가 부족합니다 (보유 ${e.detail.have}개, 입력 ${e.detail.want}개)`,
      }
    }
    return { ok: false, error: e instanceof Error ? e.message : '저장에 실패했습니다' }
  }

  revalidatePath('/')
  revalidatePath('/fulfillment')
  revalidatePath(`/fulfillment/${input.locationId}`)

  const total = lines.reduce((s, l) => s + l.qty, 0)
  return {
    ok: true,
    message: lines.length
      ? `${location.name} · ${lines.length}종 ${total}개 반영`
      : `${location.name} · 출고 없음으로 반영`,
  }
}
