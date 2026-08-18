'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ExpiryKeypad } from './ExpiryKeypad'
import { PickerRow } from './PickerRow'
import { QtyInput } from './QtyInput'
import { ProductPicker, type PickProduct } from './ProductPicker'
import { Qty } from './Qty'
import { saveInbound } from '@/actions/inbound'
import { parseExpiryInput, formatDate, humanizeRemaining } from '@/lib/date'
import { INBOUND_REASONS, REASON_LABEL, type ReasonCode } from '@/lib/constants'

type Line = { expiry: string; qty: number }

export function InboundForm({
  products,
  locations,
  recentExpiries,
  todayCount,
}: {
  products: PickProduct[]
  locations: { id: number; name: string }[]
  recentExpiries: string[]
  todayCount: number
}) {
  const router = useRouter()
  const [product, setProduct] = useState<PickProduct | null>(null)
  const [locationId, setLocationId] = useState(String(locations[0]?.id ?? ''))
  const [reason, setReason] = useState<ReasonCode>('PURCHASE')
  const [note, setNote] = useState('')
  const [keypad, setKeypad] = useState('')
  const [qty, setQty] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [count, setCount] = useState(todayCount)

  const parsed = parseExpiryInput(keypad)
  const canAdd = !!parsed.date && Number(qty) > 0

  const addLine = () => {
    if (!parsed.date || Number(qty) <= 0) return
    setLines((prev) => [...prev, { expiry: formatDate(parsed.date!), qty: Number(qty) }])
    setKeypad('')
    setQty('')
  }

  const submit = async () => {
    if (!product) return
    const all = [...lines]
    if (parsed.date && Number(qty) > 0) all.push({ expiry: formatDate(parsed.date), qty: Number(qty) })
    if (!all.length) return setError('유통기한과 수량을 입력하세요')

    setPending(true)
    setError(null)
    const res = await saveInbound({
      productId: product.id,
      locationId: Number(locationId),
      reason,
      note: note || undefined,
      lines: all,
    })
    setPending(false)

    if (!res.ok) return setError(res.error)

    // 저장 후 확인창 없이 다음 상품으로 (P1)
    setSaved(res.message)
    setCount((c) => c + all.length)
    setProduct(null)
    setLines([])
    setKeypad('')
    setQty('')
    setNote('')
    router.refresh()
  }

  if (!product) {
    return (
      <main className="pb-10">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <Link href="/" className="text-[14.5px] font-extrabold">
            ‹ 입고
          </Link>
          <span className="text-[11px] text-sub">오늘 {count}건</span>
        </header>
        {saved && (
          <p className="border-b border-ok-bg bg-ok-bg px-4 py-2.5 text-[12px] font-bold text-ok">
            ✓ {saved} — 저장했습니다. 이어서 다음 상품을 입력하세요
          </p>
        )}
        <ProductPicker products={products} onPick={setProduct} title="상품 검색" />
      </main>
    )
  }

  return (
    <main className="pb-32">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <button onClick={() => setProduct(null)} className="text-[14.5px] font-extrabold">
          ‹ 입고
        </button>
        <span className="text-[11px] text-sub">오늘 {count}건</span>
      </header>

      <PickerRow
        items={[
          {
            label: '받는 곳',
            value: locationId,
            options: locations.map((l) => ({ value: String(l.id), label: `📍 ${l.name}` })),
            onChange: setLocationId,
          },
          {
            label: '사유',
            value: reason,
            options: INBOUND_REASONS.map((r) => ({ value: r, label: REASON_LABEL[r] })),
            onChange: (v) => setReason(v as ReasonCode),
          },
        ]}
      />

      <p className="mx-4 mt-3 rounded-xl border border-acc-line bg-acc-soft px-3.5 py-2.5 text-[13px] font-bold text-acc">
        🦴 {product.name}
      </p>

      {reason === 'RETURN' && (
        <p className="mx-4 mt-2 text-[11px] text-amber">
          반품은 어느 박스가 돌아왔는지 알 수 없으므로 유통기한을 다시 확인해 입력하세요
        </p>
      )}

      <ExpiryKeypad
        value={keypad}
        onChange={setKeypad}
        recent={recentExpiries}
        onEnter={addLine}
        enterLabel="＋ 기한"
      />

      <div className="mx-4 mt-3">
        <label className="mb-1 block text-[10.5px] text-sub">수량</label>
        <QtyInput value={qty} onChange={setQty} unit={product.unit} />
      </div>

      {lines.length > 0 && (
        <>
          <p className="px-4 pb-1 pt-4 text-[10.5px] font-extrabold tracking-wider text-sub">
            이번 입고에 담긴 것
          </p>
          {lines.map((l, i) => (
            <div
              key={i}
              className="flex items-center justify-between border-b border-line px-4 py-2.5"
            >
              <div>
                <p className="text-[12.5px] font-bold tnum">{l.expiry}</p>
                <p className="text-[10.5px] text-sub">{humanizeRemaining(new Date(l.expiry))}</p>
              </div>
              <div className="flex items-center gap-3">
                <Qty value={l.qty} unit={product.unit} size="md" />
                <button
                  onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))}
                  className="text-[11px] font-bold text-amber"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {reason === 'OTHER' && (
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="메모 (사유가 기타일 때 필수)"
          className="mx-4 mt-3 w-[calc(100%-2rem)] rounded-xl border border-[#e2ddec] px-3.5 py-2.5 text-[12.5px] outline-none"
        />
      )}

      {error && (
        <p className="mx-4 mt-3 rounded-xl bg-red-bg px-3.5 py-2.5 text-[12px] font-bold text-red">
          {error}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-[560px] border-t border-line bg-white p-3 lg:max-w-[960px]">
        <button
          onClick={submit}
          disabled={pending || (!canAdd && lines.length === 0)}
          className="acc-grad w-full rounded-xl py-3.5 text-[14.5px] font-extrabold text-white disabled:opacity-40"
        >
          {pending ? '저장 중…' : '저장하고 다음 상품'}
        </button>
      </div>
    </main>
  )
}
