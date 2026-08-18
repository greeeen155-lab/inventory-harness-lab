import Link from 'next/link'
import { formatDate, humanizeRemaining } from '@/lib/date'
import { ExpiryBadge } from './StatusBadge'
import { Qty } from './Qty'
import type { StockRowData } from '@/lib/inventory'

/**
 * 재고 목록 한 줄 (05-design 4.4)
 * 3행 구조: 상품명 / 거점 요약 / 가장 임박한 로트(날짜·남은일수·거점·수량)
 * 배지만으로는 "언제까지인지"를 알 수 없으므로 날짜를 반드시 함께 보여준다.
 */
export function StockRow({ row }: { row: StockRowData }) {
  const h = row.headline
  return (
    <Link
      href={`/products/${row.productId}`}
      className="flex items-start justify-between gap-3 border-b border-[#f5f2fa] px-4 py-3 active:bg-dim"
    >
      <div className="min-w-0">
        <p className="text-[13px] font-bold">{row.name}</p>

        <p className="mt-[3px] text-[11px] text-[#7a7390]">
          {row.byLocation.length > 0
            ? row.byLocation.map((l) => `${l.name} ${l.qty}${row.unit}`).join(' · ')
            : '재고 없음'}
        </p>

        {h && (
          <p className="mt-[5px] flex flex-wrap items-center gap-1.5 text-[11px] tnum">
            <ExpiryBadge
              status={h.status}
              suffix={h.status === 'EXPIRED' ? undefined : undefined}
            />
            <span className="font-bold text-[#3f3856]">{formatDate(h.expiryDate)}</span>
            <span className="text-[#8b859c]">
              · {humanizeRemaining(h.expiryDate)} · <b className="text-[#5b5570]">{h.locationName}</b>{' '}
              {h.qty}{row.unit}
            </span>
          </p>
        )}

        {row.excluded.length > 0 && (
          <p className="mt-[3px] text-[10.5px] text-[#a9a3b8]">
            가용 제외 · {row.excluded.map((l) => `${l.name} ${l.qty}${row.unit}`).join(' · ')}
          </p>
        )}
      </div>

      <div className="shrink-0 text-right">
        <Qty value={row.available} unit={row.unit} size="xl" />
        <p className="text-[10px] font-semibold text-[#7a7390]">가용</p>
      </div>
    </Link>
  )
}
