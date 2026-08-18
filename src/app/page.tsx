import { SearchHeader } from '@/components/SearchHeader'
import { TodoBanner } from '@/components/TodoBanner'
import { FilterSegment } from '@/components/FilterSegment'
import { StockRow } from '@/components/StockRow'
import { ActionFab } from '@/components/ActionFab'
import { getExpiryCounts, getLocations, getStockRows, getSummary, getTodos } from '@/lib/inventory'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>
}) {
  const { q, filter } = await searchParams
  const [user, summary, todos, counts, locations, rows] = await Promise.all([
    getSession(),
    getSummary(),
    getTodos(),
    getExpiryCounts(),
    getLocations(),
    getStockRows({ q, filter }),
  ])

  return (
    <main className="pb-24">
      <SearchHeader
        skuCount={summary.skuCount}
        available={summary.available}
        q={q}
        userName={user?.name ?? ''}
      />

      <TodoBanner
        pendingReflect={todos.pendingReflect}
        pendingNames={todos.fulfillments.filter((f) => !f.done).map((f) => f.name)}
        transfersDelayed={todos.transfersDelayed}
        expiredCount={todos.expiredCount}
      />

      <FilterSegment
        active={filter ?? 'all'}
        q={q}
        soon={counts.soon}
        expired={counts.expired}
        locations={locations}
      />

      {q && (
        <p className="px-4 py-2 text-[11.5px] text-sub">
          &lsquo;{q}&rsquo; 검색 결과 {rows.length}건
        </p>
      )}

      {rows.length === 0 ? (
        <p className="px-4 py-16 text-center text-[13px] text-sub">
          조건에 맞는 상품이 없습니다
        </p>
      ) : (
        <ul>
          {rows.map((row) => (
            <li key={row.productId}>
              <StockRow row={row} />
            </li>
          ))}
        </ul>
      )}

      <ActionFab />
    </main>
  )
}
