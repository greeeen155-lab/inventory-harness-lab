import Link from 'next/link'

/**
 * 오늘 할 일 (E2) — 얇은 한 줄.
 * 항목은 세 종류로 고정하고, 다 끝내면 렌더하지 않는다.
 */
export function TodoBanner({
  pendingReflect,
  pendingNames,
  transfersDelayed,
  expiredCount,
}: {
  pendingReflect: number
  pendingNames: string[]
  transfersDelayed: number
  expiredCount: number
}) {
  const parts: string[] = []
  if (pendingReflect > 0) parts.push(`${pendingNames.join('·')} 미반영`)
  if (transfersDelayed > 0) parts.push(`배송 지연 ${transfersDelayed}건`)
  if (expiredCount > 0) parts.push(`만료 ${expiredCount}건`)

  if (parts.length === 0) return null

  return (
    <Link
      href={pendingReflect > 0 ? '/fulfillment' : transfersDelayed > 0 ? '/transfers' : '/expiry'}
      className="flex items-center justify-between border-b border-[#f3e3cd] bg-amber-bg px-4 py-2.5 text-[11.5px] font-semibold text-amber"
    >
      <span>⚠ 오늘 할 일 {parts.length} · {parts.join(' · ')}</span>
      <span>›</span>
    </Link>
  )
}
