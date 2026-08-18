'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireUser, SessionExpiredError } from '@/lib/auth'
import { applyMovement } from '@/lib/stock'
import { MOVEMENT_TYPES, REASON_CODES, REASON_REQUIRES_NOTE, type ReasonCode } from '@/lib/constants'
import { dateOnly } from '@/lib/date'

export type InboundLine = { expiry: string; qty: number } // expiry: 'YYYY-MM-DD'

export type SaveResult = { ok: true; message: string } | { ok: false; error: string }

/**
 * 입고 (S1)
 * 한 상품에 유통기한이 여러 개 섞여 들어오는 것이 정상이므로 여러 줄을 한 번에 받는다.
 */
export async function saveInbound(input: {
  productId: number
  locationId: number
  reason: ReasonCode
  note?: string
  lines: InboundLine[]
}): Promise<SaveResult> {
  let user
  try {
    user = await requireUser()
  } catch (e) {
    if (e instanceof SessionExpiredError) return { ok: false, error: e.message }
    throw e
  }

  if (!input.lines.length) return { ok: false, error: '입고할 유통기한과 수량을 입력하세요' }
  if (input.lines.some((l) => !l.expiry || l.qty <= 0))
    return { ok: false, error: '유통기한과 수량을 확인하세요' }
  if (REASON_REQUIRES_NOTE.includes(input.reason) && !input.note?.trim())
    return { ok: false, error: '사유가 기타일 때는 메모가 필요합니다' }

  const product = await db.product.findUnique({ where: { id: input.productId } })
  if (!product) return { ok: false, error: '상품을 찾을 수 없습니다' }

  try {
    await db.$transaction(async (tx) => {
      for (const line of input.lines) {
        await applyMovement(tx, {
          type: MOVEMENT_TYPES.INBOUND,
          reason: input.reason ?? REASON_CODES.PURCHASE,
          note: input.note,
          productId: input.productId,
          expiryDate: dateOnly(new Date(line.expiry)),
          quantity: line.qty,
          toLocationId: input.locationId,
          userId: user.id,
        })
      }
    })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '저장에 실패했습니다' }
  }

  revalidatePath('/')
  revalidatePath(`/products/${input.productId}`)

  const total = input.lines.reduce((s, l) => s + l.qty, 0)
  return { ok: true, message: `${product.name} ${total}개 입고` }
}
