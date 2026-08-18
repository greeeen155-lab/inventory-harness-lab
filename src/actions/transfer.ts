'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { applyMovement, InsufficientStockError } from '@/lib/stock'
import { ALLOCATION, allocateLots } from '@/lib/fefo'
import { LOCATION_TYPES, MOVEMENT_TYPES, REASON_CODES, TRANSFER_STATUS } from '@/lib/constants'
import type { SaveResult } from './inbound'

async function transitLocation() {
  return db.location.findFirstOrThrow({ where: { type: LOCATION_TYPES.TRANSIT } })
}

/**
 * 풀필먼트 발송 (S3)
 * 재고는 자사창고 → '배송 중'으로 옮겨간다. 총 재고는 변하지 않는다.
 * 도착 확인 전까지 이 재고는 가용에서 빠지지만 사라지지는 않는다.
 */
export async function sendTransfer(input: {
  fromLocationId: number
  toLocationId: number
  note?: string
  lines: { productId: number; quantity: number }[]
}): Promise<SaveResult & { transferId?: number }> {
  const user = await requireUser()

  if (!input.lines.length) return { ok: false, error: '보낼 상품을 담으세요' }
  if (input.fromLocationId === input.toLocationId)
    return { ok: false, error: '출발지와 도착지가 같습니다' }

  const transit = await transitLocation()

  try {
    const transferId = await db.$transaction(async (tx) => {
      const transfer = await tx.transfer.create({
        data: {
          fromLocationId: input.fromLocationId,
          toLocationId: input.toLocationId,
          status: TRANSFER_STATUS.SENT,
          note: input.note,
          sentById: user.id,
        },
      })

      for (const line of input.lines) {
        // 발송은 출고와 반대다 — 유통기한이 넉넉한 것부터 보낸다 (LEFO)
        // 풀필먼트는 도착까지 3~5일, 판매까지 더 걸려서 임박분을 보내면 기한이 지난다
        const plan = await allocateLots(tx, {
          productId: line.productId,
          locationId: input.fromLocationId,
          quantity: line.quantity,
          strategy: ALLOCATION.LEFO,
        })

        for (const a of plan) {
          await tx.transferLine.create({
            data: {
              transferId: transfer.id,
              productId: line.productId,
              expiryDate: a.expiryDate,
              sentQty: a.qty,
            },
          })
          await applyMovement(tx, {
            type: MOVEMENT_TYPES.TRANSFER,
            productId: line.productId,
            expiryDate: a.expiryDate,
            quantity: a.qty,
            fromLocationId: input.fromLocationId,
            toLocationId: transit.id, // ★ 사라지지 않고 '배송 중'에 있다
            transferId: transfer.id,
            userId: user.id,
          })
        }
      }
      return transfer.id
    })

    revalidatePath('/')
    revalidatePath('/transfers')
    return { ok: true, message: '발송했습니다. 도착 확인 전까지 배송 중에 있습니다', transferId }
  } catch (e) {
    if (e instanceof InsufficientStockError) {
      return { ok: false, error: `재고가 부족합니다 (보유 ${e.detail.have}개, 요청 ${e.detail.want}개)` }
    }
    return { ok: false, error: e instanceof Error ? e.message : '발송에 실패했습니다' }
  }
}

/**
 * 도착 확인 (S4)
 * 풀필먼트사 입고 문자를 보고 확인한다.
 * 문자에 적힌 수량이 다르면 실제 수량으로 고치고, 차이는 조정 기록으로 남긴다.
 */
export async function receiveTransfer(input: {
  transferId: number
  lines: { lineId: number; receivedQty: number }[]
  note?: string
}): Promise<SaveResult> {
  const user = await requireUser()
  const transit = await transitLocation()

  const transfer = await db.transfer.findUnique({
    where: { id: input.transferId },
    include: { lines: true },
  })
  if (!transfer) return { ok: false, error: '발송 건을 찾을 수 없습니다' }
  if (transfer.status !== TRANSFER_STATUS.SENT)
    return { ok: false, error: '이미 처리된 발송 건입니다' }

  try {
    await db.$transaction(async (tx) => {
      for (const line of transfer.lines) {
        const input_ = input.lines.find((l) => l.lineId === line.id)
        const received = input_ ? input_.receivedQty : line.sentQty
        if (received < 0) throw new Error('도착 수량은 0 이상이어야 합니다')

        const moved = Math.min(received, line.sentQty)
        if (moved > 0) {
          await applyMovement(tx, {
            type: MOVEMENT_TYPES.TRANSFER,
            productId: line.productId,
            expiryDate: line.expiryDate,
            quantity: moved,
            fromLocationId: transit.id,
            toLocationId: transfer.toLocationId,
            transferId: transfer.id,
            userId: user.id,
          })
        }

        // 보낸 것보다 적게 도착 — 차이는 배송 중에서 조정으로 뺀다 (분실·파손)
        if (received < line.sentQty) {
          await applyMovement(tx, {
            type: MOVEMENT_TYPES.ADJUST,
            reason: REASON_CODES.COUNT_DIFF,
            note: input.note ?? `도착 수량 차이 (보낸 ${line.sentQty} → 도착 ${received})`,
            productId: line.productId,
            expiryDate: line.expiryDate,
            quantity: line.sentQty - received,
            fromLocationId: transit.id,
            userId: user.id,
            transferId: transfer.id,
          })
        }

        // 보낸 것보다 많이 도착 — 실물이 진실이므로 도착지에 더한다
        if (received > line.sentQty) {
          await applyMovement(tx, {
            type: MOVEMENT_TYPES.ADJUST,
            reason: REASON_CODES.COUNT_DIFF,
            note: input.note ?? `도착 수량 차이 (보낸 ${line.sentQty} → 도착 ${received})`,
            productId: line.productId,
            expiryDate: line.expiryDate,
            quantity: received - line.sentQty,
            toLocationId: transfer.toLocationId,
            userId: user.id,
            transferId: transfer.id,
          })
        }

        await tx.transferLine.update({
          where: { id: line.id },
          data: { receivedQty: received },
        })
      }

      await tx.transfer.update({
        where: { id: transfer.id },
        data: {
          status: TRANSFER_STATUS.RECEIVED,
          receivedAt: new Date(),
          receivedById: user.id,
        },
      })
    })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '도착 처리에 실패했습니다' }
  }

  revalidatePath('/')
  revalidatePath('/transfers')
  return { ok: true, message: '도착 확인 완료' }
}
