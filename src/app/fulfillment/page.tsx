import Link from 'next/link'
import { Badge } from '@/components/StatusBadge'
import { getFulfillmentLocations, reflectedLabel } from '@/lib/inventory'
import { formatDate } from '@/lib/date'

export const dynamic = 'force-dynamic'

export default async function FulfillmentPage() {
  const locations = await getFulfillmentLocations()
  const pending = locations.filter((l) => !l.doneToday)

  return (
    <main className="pb-16">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <Link href="/" className="text-[14.5px] font-extrabold">
          ‹ 풀필먼트 일일 반영
        </Link>
      </header>

      <p className="border-b border-line bg-dim px-4 py-2.5 text-[11.5px] leading-relaxed text-[#5b5570]">
        {pending.length === 0 ? (
          <>오늘 3사 모두 반영했습니다. 재고 숫자를 믿어도 됩니다</>
        ) : (
          <>
            오늘 반영이 남은 곳 <b>{pending.length}곳</b>. 반영하지 않은 거점은 앱의 숫자가 실제보다
            많습니다
          </>
        )}
      </p>

      {locations.map((l) => (
        <Link
          key={l.id}
          href={`/fulfillment/${l.id}`}
          className={`flex items-center justify-between border-b border-line px-4 py-3.5 ${
            l.doneToday ? '' : 'bg-[#fffdf8]'
          }`}
        >
          <div>
            <p className="text-[13.5px] font-bold">
              {l.doneToday ? '✅' : '⬜'} {l.name}
            </p>
            <p className="mt-[3px] text-[11px] text-sub tnum">
              마지막 반영 <b className={l.doneToday ? 'text-ok' : 'text-amber'}>
                {reflectedLabel(l.daysSince)}
              </b>
              {l.lastReflectedAt && ` · ${formatDate(l.lastReflectedAt)}`} · {l.skuCount}종{' '}
              {l.total.toLocaleString()}개 보유
            </p>
          </div>
          <div className="flex items-center gap-2">
            {l.doneToday ? <Badge tone="ok">완료</Badge> : <Badge tone="amber">미반영</Badge>}
            <span className="text-sub">›</span>
          </div>
        </Link>
      ))}

      <p className="mx-4 mt-4 rounded-xl bg-dim px-3.5 py-3 text-[11.5px] leading-relaxed text-[#5b5570]">
        풀필먼트 재고는 우리가 직접 세지 않습니다. 저쪽 관리자 페이지의 <b>어제 출고 수량</b>을 매일
        옮겨 적어야 숫자가 맞습니다. 로트는 유통기한이 빠른 것부터 자동 차감됩니다.
      </p>
    </main>
  )
}
