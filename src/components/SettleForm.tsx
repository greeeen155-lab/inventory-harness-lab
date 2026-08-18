'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BulkInputRow } from './BulkInputRow'
import { QtyInput } from './QtyInput'
import { SettlementKpi, SettlementSentence } from './SettlementSentence'
import { settlePopup } from '@/actions/popup'
import { formatDate } from '@/lib/date'

export type SettleLot = {
  lotId: number
  productId: number
  name: string
  unit: string
  expiry: string
  quantity: number // 팝업에 남아 있는 장부 수량 = 누적 반출 − 이미 정산된 것
}

/**
 * 팝업 정산 (S9) — 현장이 아니라 복귀 후 책상에서 하는 일이다 (T6).
 *
 * ① 로트별로 남은 실물 수량을 센 대로 넣는다 (유통기한을 보존해야 복귀 로트가 맞는다)
 * ② 역산 결과를 문장으로 확인하고 확정한다
 */
export function SettleForm({
  popupId,
  popupName,
  lots,
  sourceName,
}: {
  popupId: number
  popupName: string
  lots: SettleLot[]
  sourceName: string
}) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [returns, setReturns] = useState<Record<number, string>>({})
  const [samples, setSamples] = useState<Record<number, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const rows = useMemo(
    () =>
      lots.map((lot) => {
        const returned = Number(returns[lot.lotId] ?? '') || 0
        return { lot, returned, consumed: lot.quantity - returned, over: returned > lot.quantity }
      }),
    [lots, returns]
  )

  /** 시식·증정은 상품 단위로 입력받는다 — 어느 유통기한이 시식으로 나갔는지는 아무도 모른다 */
  const products = useMemo(() => {
    const map = new Map<number, { productId: number; name: string; unit: string; consumed: number }>()
    for (const r of rows) {
      const cur = map.get(r.lot.productId) ?? {
        productId: r.lot.productId,
        name: r.lot.name,
        unit: r.lot.unit,
        consumed: 0,
      }
      cur.consumed += Math.max(0, r.consumed)
      map.set(r.lot.productId, cur)
    }
    return [...map.values()]
  }, [rows])

  const totals = useMemo(() => {
    const shipped = lots.reduce((s, l) => s + l.quantity, 0)
    const returned = rows.reduce((s, r) => s + Math.min(r.returned, r.lot.quantity), 0)
    const sample = products.reduce(
      (s, p) => s + Math.min(Number(samples[p.productId] ?? '') || 0, p.consumed),
      0
    )
    return { shipped, returned, sample, sold: shipped - returned - sample }
  }, [lots, rows, products, samples])

  const overLot = rows.some((r) => r.over)
  const overSample = products.some((p) => (Number(samples[p.productId] ?? '') || 0) > p.consumed)
  const blocked = overLot || overSample

  const confirm = async () => {
    setPending(true)
    setError(null)
    const res = await settlePopup({
      popupId,
      returns: rows.filter((r) => r.returned > 0).map((r) => ({ lotId: r.lot.lotId, qty: r.returned })),
      samples: products
        .map((p) => ({ productId: p.productId, qty: Number(samples[p.productId] ?? '') || 0 }))
        .filter((s) => s.qty > 0),
    })
    setPending(false)
    if (!res.ok) {
      setStep(1)
      return setError(res.error)
    }
    router.push(`/popups/${popupId}`)
    router.refresh()
  }

  if (step === 2) {
    return (
      <main className="pb-32">
        <header className="border-b border-line px-4 py-3">
          <button onClick={() => setStep(1)} className="text-[14.5px] font-extrabold">
            ‹ 계산 확인
          </button>
        </header>

        <SettlementSentence {...totals} />
        <SettlementKpi {...totals} />

        <div className="mx-4 mt-4 rounded-xl bg-dim px-3.5 py-3 text-[11.5px] leading-relaxed text-[#5b5570]">
          확정하면 판매·시식 분은 재고에서 나가고, 잔여 <b>{totals.returned}개</b>는 유통기한
          그대로 <b>{sourceName}</b>으로 돌아옵니다. 팝업 거점은 재고 0으로 종료됩니다.
          <br />
          실물을 잘못 셌다면 확정 후에도 <b>정산 되돌리기</b>가 가능합니다.
        </div>

        <div className="fixed inset-x-0 bottom-0 mx-auto max-w-[560px] border-t border-line bg-white p-3 lg:max-w-[960px]">
          <button
            onClick={confirm}
            disabled={pending}
            className="acc-grad w-full rounded-xl py-3.5 text-[14.5px] font-extrabold text-white disabled:opacity-40"
          >
            {pending ? '정산 중…' : '정산 확정'}
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="pb-32">
      <header className="border-b border-line px-4 py-3">
        <Link href={`/popups/${popupId}`} className="text-[14.5px] font-extrabold">
          ‹ {popupName} 정산
        </Link>
      </header>

      <p className="border-b border-line bg-dim px-4 py-2.5 text-[11.5px] leading-relaxed text-[#5b5570]">
        돌아온 상자를 세어 <b>남은 실물 수량</b>을 넣으세요. 판매량은 앱이 역산합니다.
        입력하지 않은 줄은 <b>0개 남은 것</b>으로 봅니다.
      </p>

      <div className="hidden border-y border-line bg-dim px-4 py-1.5 text-[10.5px] font-extrabold tracking-wider text-sub lg:grid lg:grid-cols-[minmax(0,1.4fr)_112px_112px_minmax(0,1.6fr)] lg:gap-x-3">
        <span>상품 · 유통기한</span>
        <span className="text-right">누적 반출</span>
        <span className="text-center">남은 실물</span>
        <span>차감</span>
      </div>

      {rows.map((r) => (
        <BulkInputRow
          key={r.lot.lotId}
          name={r.lot.name}
          sub={`유통기한 ${formatDate(new Date(r.lot.expiry))}`}
          unit={r.lot.unit}
          ariaLabel={`${r.lot.name} ${formatDate(new Date(r.lot.expiry))} 남은 수량`}
          value={returns[r.lot.lotId] ?? ''}
          onChange={(v) => setReturns((p) => ({ ...p, [r.lot.lotId]: v }))}
          tone={r.over ? 'error' : r.returned > 0 ? 'filled' : 'idle'}
          info={<>반출 {r.lot.quantity.toLocaleString()}</>}
          result={
            r.over ? (
              <b className="text-red">반출한 {r.lot.quantity}개보다 많이 돌아올 수 없습니다</b>
            ) : (
              <>
                차감{' '}
                <b className={r.consumed > 0 ? 'text-acc' : ''}>
                  {r.consumed.toLocaleString()}
                  {r.lot.unit}
                </b>
              </>
            )
          }
        />
      ))}

      <p className="px-4 pb-1 pt-5 text-[10.5px] font-extrabold tracking-wider text-sub">
        시식·증정으로 나간 수량 (모르면 0)
      </p>
      {products.map((p) => {
        const v = Number(samples[p.productId] ?? '') || 0
        const over = v > p.consumed
        return (
          <div
            key={p.productId}
            className={`flex items-center justify-between border-b border-line px-4 py-2.5 ${over ? 'bg-red-bg' : ''}`}
          >
            <div>
              <p className="text-[13px] font-bold">{p.name}</p>
              <p className="text-[10.5px] text-sub tnum">
                차감 {p.consumed}
                {p.unit} 중{' '}
                {over ? (
                  <b className="text-red">차감분보다 많습니다</b>
                ) : (
                  <>판매 {Math.max(0, p.consumed - v)}{p.unit}</>
                )}
              </p>
            </div>
            <QtyInput
              size="sm"
              className="w-[84px]"
              value={samples[p.productId] ?? ''}
              onChange={(val) => setSamples((s) => ({ ...s, [p.productId]: val }))}
              unit={p.unit}
              aria-label={`${p.name} 시식·증정 수량`}
              tone={over ? 'error' : v > 0 ? 'filled' : 'idle'}
            />
          </div>
        )
      })}

      {error && (
        <p className="mx-4 mt-3 rounded-xl bg-red-bg px-3.5 py-2.5 text-[12px] font-bold text-red">
          {error}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-[560px] border-t border-line bg-white p-3 lg:max-w-[960px]">
        <div className="mb-2 px-1 text-[11.5px] font-bold text-[#5b5570] tnum">
          반출 {totals.shipped} · 반입 {totals.returned} · 차감 {totals.shipped - totals.returned}
        </div>
        <button
          onClick={() => setStep(2)}
          disabled={blocked}
          className="acc-grad w-full rounded-xl py-3.5 text-[14.5px] font-extrabold text-white disabled:opacity-40"
        >
          {blocked ? '입력을 확인하세요' : '다음 — 계산 확인'}
        </button>
      </div>
    </main>
  )
}
