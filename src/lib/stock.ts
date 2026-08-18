import type { Prisma } from '@/generated/prisma/client'
import { dateOnly } from './date'
import type { MovementType, ReasonCode } from './constants'

/**
 * ★ 재고 수량을 바꾸는 유일한 통로.
 *
 * 화면·액션 코드는 절대 lot.update()를 직접 호출하지 않는다.
 * 재고 변경과 이력 기록은 반드시 같은 트랜잭션에서 함께 성공하거나 함께 롤백된다.
 *
 * from/to 규칙
 *   from = null  → 외부에서 들어옴 (입고·반품)
 *   to   = null  → 외부로 나감   (판매·시식·폐기 아님, 실제 소진)
 *   둘 다 있으면 → 내부 이동. 총 재고는 변하지 않는다.
 */

export type MovementInput = {
  type: MovementType
  reason?: ReasonCode | null
  note?: string | null
  productId: number
  expiryDate: Date
  quantity: number // 항상 양수
  fromLocationId?: number | null
  toLocationId?: number | null
  transferId?: number | null
  popupId?: number | null
  reversalOfId?: number | null
  userId: number
  createdAt?: Date // 시드·백데이팅용
}

export class InsufficientStockError extends Error {
  constructor(
    readonly detail: { productId: number; locationId: number; want: number; have: number }
  ) {
    super(
      `재고가 부족합니다 (상품 ${detail.productId} / 거점 ${detail.locationId}: 보유 ${detail.have}, 요청 ${detail.want})`
    )
    this.name = 'InsufficientStockError'
  }
}

export async function applyMovement(tx: Prisma.TransactionClient, input: MovementInput) {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new Error('수량은 1 이상의 정수여야 합니다')
  }
  if (input.fromLocationId == null && input.toLocationId == null) {
    throw new Error('출발지와 도착지가 모두 없는 이동은 만들 수 없습니다')
  }

  const expiryDate = dateOnly(input.expiryDate)

  // ① 출발지에서 차감 — 음수 재고 금지
  if (input.fromLocationId != null) {
    const lot = await tx.lot.findUnique({
      where: {
        productId_locationId_expiryDate: {
          productId: input.productId,
          locationId: input.fromLocationId,
          expiryDate,
        },
      },
    })
    if (!lot || lot.quantity < input.quantity) {
      throw new InsufficientStockError({
        productId: input.productId,
        locationId: input.fromLocationId,
        want: input.quantity,
        have: lot?.quantity ?? 0,
      })
    }
    await tx.lot.update({
      where: { id: lot.id },
      data: { quantity: { decrement: input.quantity } },
    })
  }

  // ② 도착지에 가산 — 같은 (상품·거점·유통기한)이면 합쳐지고, 없으면 새 로트가 생긴다
  if (input.toLocationId != null) {
    await tx.lot.upsert({
      where: {
        productId_locationId_expiryDate: {
          productId: input.productId,
          locationId: input.toLocationId,
          expiryDate,
        },
      },
      create: {
        productId: input.productId,
        locationId: input.toLocationId,
        expiryDate,
        quantity: input.quantity,
      },
      update: { quantity: { increment: input.quantity } },
    })
  }

  // ③ 이력 기록 — 언제나 함께
  return tx.movement.create({
    data: {
      type: input.type,
      reason: input.reason ?? null,
      note: input.note ?? null,
      productId: input.productId,
      expiryDate,
      quantity: input.quantity,
      fromLocationId: input.fromLocationId ?? null,
      toLocationId: input.toLocationId ?? null,
      transferId: input.transferId ?? null,
      popupId: input.popupId ?? null,
      reversalOfId: input.reversalOfId ?? null,
      userId: input.userId,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    },
  })
}

/**
 * 취소 = 삭제가 아니라 방향을 뒤집은 상쇄 기록.
 * 원본은 그대로 남고, 이력에 두 줄이 보인다.
 */
export async function reverseMovement(
  tx: Prisma.TransactionClient,
  movementId: number,
  userId: number,
  note?: string
) {
  const origin = await tx.movement.findUnique({ where: { id: movementId } })
  if (!origin) throw new Error('취소할 기록을 찾을 수 없습니다')
  if (origin.reversalOfId) throw new Error('상쇄 기록은 다시 취소할 수 없습니다')

  const already = await tx.movement.findFirst({ where: { reversalOfId: movementId } })
  if (already) throw new Error('이미 취소된 기록입니다')

  return applyMovement(tx, {
    type: origin.type as MovementType,
    reason: (origin.reason as ReasonCode) ?? null,
    note: note ?? `취소: #${origin.id}`,
    productId: origin.productId,
    expiryDate: origin.expiryDate,
    quantity: origin.quantity,
    fromLocationId: origin.toLocationId, // ← 방향을 뒤집는다
    toLocationId: origin.fromLocationId,
    transferId: origin.transferId,
    popupId: origin.popupId,
    reversalOfId: origin.id,
    userId,
  })
}
