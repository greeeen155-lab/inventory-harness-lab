import { formatDate, humanizeRemaining } from '@/lib/date'
import { ExpiryBadge } from './StatusBadge'
import { Qty } from './Qty'
import type { ExpiryStatus } from '@/lib/expiry'

/**
 * 로트 카드 (05-design 4.5)
 * 로트 = 거점 × 유통기한. 날짜로 묶되 안에 거점별 수량을 반드시 나열한다.
 * 순위 배지가 곧 FEFO 출고 순서다.
 */
export function LotCard({
  expiryDate,
  total,
  rank,
  status,
  entries,
  unit = '개',
}: {
  expiryDate: Date
  total: number
  rank: number
  status: ExpiryStatus
  entries: { locationName: string; qty: number }[]
  unit?: string
}) {
  const warn = status !== 'OK'
  return (
    <div
      className={`mt-2 overflow-hidden rounded-2xl border ${
        warn ? 'border-[#f0dcc0] bg-[#fffdf8]' : 'border-line'
      }`}
    >
      <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
        <div>
          <p className="text-[13.5px] font-extrabold tracking-tight tnum">{formatDate(expiryDate)}</p>
          <p className="mt-[2px] text-[10.5px] text-sub">
            {humanizeRemaining(expiryDate)}
            {entries.length > 1 ? ` · 거점 ${entries.length}곳` : ''}
          </p>
        </div>
        <div className="text-right">
          <Qty value={total} unit={unit} size="lg" />
          <ExpiryBadge status={status} suffix={status === 'OK' ? `출고 ${rank}순위` : undefined} />
        </div>
      </div>

      {entries.map((e) => (
        <div
          key={e.locationName}
          className="flex justify-between border-b border-line px-3.5 py-2 text-[11.5px] text-[#5b5570] last:border-b-0"
        >
          <span>📍 {e.locationName}</span>
          <Qty value={e.qty} unit={unit} size="sm" />
        </div>
      ))}
    </div>
  )
}
