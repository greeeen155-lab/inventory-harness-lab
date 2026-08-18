'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { receiveTransfer } from '@/actions/transfer'
import { formatDate, humanizeRemaining } from '@/lib/date'
import { Qty } from './Qty'
import { QtyInput } from './QtyInput'

type Line = { id: number; productName: string; expiry: string; sentQty: number }

/**
 * 도착 확인 (S4)
 * 문자에 적힌 수량이 같으면 1탭. 다르면 실제 수량으로 고친다.
 */
export function ReceiveForm({
  transferId,
  lines,
  destination,
}: {
  transferId: number
  lines: Line[]
  destination: string
}) {
  const router = useRouter()
  const [edit, setEdit] = useState(false)
  const [qty, setQty] = useState<Record<number, string>>(
    Object.fromEntries(lines.map((l) => [l.id, String(l.sentQty)]))
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const diff = lines.reduce((s, l) => s + (Number(qty[l.id] ?? l.sentQty) - l.sentQty), 0)

  const submit = async () => {
    setPending(true)
    setError(null)
    const res = await receiveTransfer({
      transferId,
      lines: lines.map((l) => ({ lineId: l.id, receivedQty: Number(qty[l.id] ?? l.sentQty) })),
    })
    setPending(false)
    if (!res.ok) return setError(res.error)
    router.push('/transfers')
    router.refresh()
  }

  return (
    <>
      <p className="px-4 pb-1 pt-4 text-[10.5px] font-extrabold tracking-wider text-sub">
        보낸 목록 {edit && '· 실제 도착 수량으로 고치세요'}
      </p>

      {lines.map((l) => {
        const received = Number(qty[l.id] ?? l.sentQty)
        const gap = received - l.sentQty
        return (
          <div key={l.id} className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <p className="text-[13px] font-bold">{l.productName}</p>
              <p className="mt-[2px] text-[10.5px] text-sub tnum">
                {formatDate(new Date(l.expiry))} · {humanizeRemaining(new Date(l.expiry))} · 보낸 수량{' '}
                {l.sentQty}개
              </p>
              {gap !== 0 && (
                <p className="mt-[2px] text-[10.5px] font-bold text-amber">
                  차이 {gap > 0 ? '+' : ''}
                  {gap} — 조정 기록으로 남습니다
                </p>
              )}
            </div>
            {edit ? (
              <QtyInput
                size="sm"
                className="w-24"
                value={qty[l.id] ?? ''}
                onChange={(v) => setQty((p) => ({ ...p, [l.id]: v }))}
              />
            ) : (
              <Qty value={l.sentQty} size="lg" />
            )}
          </div>
        )
      })}

      {!edit && (
        <button
          onClick={() => setEdit(true)}
          className="mx-4 mt-3 text-[11.5px] font-extrabold text-acc"
        >
          문자에 적힌 수량이 다른가요? · 수정
        </button>
      )}

      {error && (
        <p className="mx-4 mt-3 rounded-xl bg-red-bg px-3.5 py-2.5 text-[12px] font-bold text-red">
          {error}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-[560px] border-t border-line bg-white p-3 lg:max-w-[960px]">
        <button
          onClick={submit}
          disabled={pending}
          className="acc-grad w-full rounded-xl py-3.5 text-[14.5px] font-extrabold text-white disabled:opacity-40"
        >
          {pending
            ? '처리 중…'
            : diff === 0
              ? `전량 도착 확인 · ${destination}`
              : `도착 확인 (차이 ${diff > 0 ? '+' : ''}${diff})`}
        </button>
      </div>
    </>
  )
}
