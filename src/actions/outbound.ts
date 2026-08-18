'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireUser, SessionExpiredError } from '@/lib/auth'
import { applyMovement, InsufficientStockError } from '@/lib/stock'
import { allocateFefo } from '@/lib/fefo'
import { MOVEMENT_TYPES, REASON_REQUIRES_NOTE, type ReasonCode } from '@/lib/constants'
import type { SaveResult } from './inbound'

/**
 * 출고 (S2)
 * 기본은 FEFO 자동 배분. 사용자는 총 수량만 넣고 로트 계산은 앱이 한다.
 * 다른 로트를 쓰려면 수동 선택 + 사유(메모)가 반드시 필요하다.
 */
export async function saveOutbound(input: {
  productId: number
  locationId: number
  reason: ReasonCode
  note?: string
  quantity: number
  manual?: { lotId: number; qty: number }[] // 수동 선택 시에만
}): Promise<SaveResult> {
  let user
  try {
    user = await requireUser()
  } catch (e) {
    if (e instanceof SessionExpiredError) return { ok: false, error: e.message }
    throw e
  }

  const product = await db.product.findUnique({ where: { id: input.productId } })
  if (!product) return { ok: false, error: '상품을 찾을 수 없습니다' }
  if (input.quantity <= 0) return { ok: false, error: '수량은 1 이상이어야 합니다' }
  if (REASON_REQUIRES_NOTE.includes(input.reason) && !input.note?.trim())
    return { ok: false, error: '사유가 기타일 때는 메모가 필요합니다' }

  const isManual = !!input.manual?.length
  if (isManual && !input.note?.trim())
    return { ok: false, error: 'FEFO 순서와 다르게 내보내려면 사유를 입력해야 합니다' }

  try {
    await db.$transaction(async (tx) => {
      // 저장 직전 DB의 현재 재고로 다시 계산한다 (미리보기 이후 재고가 변했을 수 있다)
      const plan = isManual
        ? await Promise.all(
            input.manual!.map(async (m) => {
              const lot = await tx.lot.findUnique({ where: { id: m.lotId } })
              if (!lot) throw new Error('선택한 로트를 찾을 수 없습니다')
              return { lotId: lot.id, expiryDate: lot.expiryDate, qty: m.qty, lotQuantity: lot.quantity }
            })
          )
        : await allocateFefo(tx, {
            productId: input.productId,
            locationId: input.locationId,
            quantity: input.quantity,
          })

      for (const a of plan) {
        await applyMovement(tx, {
          type: MOVEMENT_TYPES.OUTBOUND,
          reason: input.reason,
          note: input.note ?? (isManual ? '수동 로트 선택' : null),
          productId: input.productId,
          expiryDate: a.expiryDate,
          quantity: a.qty,
          fromLocationId: input.locationId,
          userId: user.id,
        })
      }
    })
  } catch (e) {
    if (e instanceof InsufficientStockError) {
      return { ok: false, error: `재고가 부족합니다 (보유 ${e.detail.have}개, 요청 ${e.detail.want}개)` }
    }
    return { ok: false, error: e instanceof Error ? e.message : '저장에 실패했습니다' }
  }

  revalidatePath('/')
  revalidatePath(`/products/${input.productId}`)
  return { ok: true, message: `${product.name} ${input.quantity}개 출고` }
}
