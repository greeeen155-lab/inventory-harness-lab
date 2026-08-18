'use client'

import type { ReactNode } from 'react'
import { QtyInput } from './QtyInput'

/**
 * 다건 입력 한 줄 (05-design 4.11) — 풀필먼트 일일 반영(S5)·팝업 정산(S9)이 같이 쓴다.
 *
 * 상품을 검색해서 하나씩 열지 않는다. 목록에 나열하고 수량칸만 채운다.
 * 로트 계산은 앱이 하고 화면에는 결과만 보여준다.
 *
 * 레이아웃만 공통이고 문구는 화면이 정한다 — '차감'과 '잔여'는 다른 이야기이기 때문이다.
 * 폭이 넓어지면 같은 줄이 표로 펼쳐진다.
 */
export function BulkInputRow({
  name,
  sub,
  unit,
  value,
  onChange,
  onEnter,
  info,
  result,
  tone = 'idle',
  ariaLabel,
}: {
  name: string
  /** 이름 아래 보조 문구 — SKU, 유통기한, 예정 수량 등 */
  sub?: string
  unit: string
  value: string
  onChange: (v: string) => void
  onEnter?: () => void
  /** 왼쪽 숫자 칸 — 보유 / 현재 → 변경 후 / 반출 수량 */
  info: ReactNode
  /** 오른쪽 결과 칸 — FEFO 차감 로트, 역산 결과, 경고 */
  result: ReactNode
  tone?: 'idle' | 'filled' | 'error'
  ariaLabel: string
}) {
  return (
    <div
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-[3px] border-b border-line px-4 py-2.5 lg:grid-cols-[minmax(0,1.4fr)_112px_112px_minmax(0,1.6fr)] ${
        tone === 'error' ? 'bg-red-bg' : tone === 'filled' ? 'bg-acc-soft' : ''
      }`}
    >
      <div className="min-w-0 lg:order-1">
        <p className="truncate text-[13px] font-bold">{name}</p>
        {sub && <p className="truncate text-[10.5px] text-sub tnum">{sub}</p>}
      </div>

      <div className="lg:order-3">
        <QtyInput
          size="sm"
          value={value}
          onChange={onChange}
          unit={unit}
          className="w-[84px] lg:w-full"
          onEnter={onEnter}
          aria-label={ariaLabel}
          tone={tone}
        />
      </div>

      {/* 폰에서는 한 줄, PC에서는 두 칸으로 갈라진다 */}
      <div className="col-span-2 flex flex-wrap items-center gap-x-1.5 text-[10.5px] lg:contents">
        <span className="tnum text-sub lg:order-2 lg:text-right lg:text-[11.5px]">{info}</span>
        <span className="tnum text-sub lg:order-4">{result}</span>
      </div>
    </div>
  )
}
