'use client'

import { parseExpiryInput, expiryWarning, formatDate, humanizeRemaining } from '@/lib/date'

/**
 * 유통기한 6자리 입력 (E1)
 * 입고 화면에서 가장 느린 동작이 날짜 입력이다. 캘린더 대신 숫자로 찍는다.
 *   270331 → 2027-03-31 / 2703 → 그 달의 말일
 */
export function ExpiryKeypad({
  value,
  onChange,
  recent,
  onEnter,
  enterLabel = '＋ 기한 추가',
}: {
  value: string
  onChange: (v: string) => void
  recent: string[]
  onEnter: () => void
  enterLabel?: string
}) {
  const parsed = parseExpiryInput(value)
  const warning = parsed.date ? expiryWarning(parsed.date) : null

  const press = (k: string) => {
    if (k === 'back') return onChange(value.slice(0, -1))
    if (value.length >= 6) return
    onChange(value + k)
  }

  return (
    <div>
      <div className="mx-4 mt-3 rounded-xl border-2 border-acc px-3.5 py-3 text-[20px] font-extrabold tracking-[0.14em] tnum">
        {value || <span className="text-[#c9c3d6]">YYMMDD</span>}
      </div>

      <p className="mx-4 mt-1 text-[11.5px] text-[#5b5570]">
        {parsed.date ? (
          <>
            → <b className="text-acc">{formatDate(parsed.date)}</b> · {humanizeRemaining(parsed.date)}
            {warning && <span className="ml-1 font-bold text-amber">⚠ {warning}</span>}
          </>
        ) : value.length > 0 ? (
          <span className="text-amber">{parsed.error}</span>
        ) : (
          '유통기한을 숫자로 입력하세요 (270331 또는 2703)'
        )}
      </p>

      {recent.length > 0 && (
        <div className="mx-4 mt-2 flex flex-wrap gap-1.5">
          {recent.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onChange(r.replaceAll('-', '').slice(2))}
              className="rounded-full bg-acc-soft px-2.5 py-1 text-[11px] font-extrabold text-acc"
            >
              최근 {r}
            </button>
          ))}
        </div>
      )}

      <div className="mx-4 mt-3 grid grid-cols-3 gap-1.5">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            className="rounded-xl bg-[#f5f3f9] py-3 text-[17px] font-bold active:bg-acc-soft"
          >
            {k}
          </button>
        ))}
        <button
          type="button"
          onClick={onEnter}
          disabled={!parsed.date}
          className="rounded-xl bg-acc-soft py-3 text-[12px] font-extrabold text-acc disabled:opacity-40"
        >
          {enterLabel}
        </button>
        <button
          type="button"
          onClick={() => press('0')}
          className="rounded-xl bg-[#f5f3f9] py-3 text-[17px] font-bold active:bg-acc-soft"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => press('back')}
          className="rounded-xl bg-[#f5f3f9] py-3 text-[17px] font-bold active:bg-acc-soft"
        >
          ⌫
        </button>
      </div>
    </div>
  )
}
