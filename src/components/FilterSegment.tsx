import Link from 'next/link'

type Chip = { key: string; label: string; tone?: 'warn' }

export function FilterSegment({
  active,
  q,
  soon,
  expired,
  locations,
}: {
  active: string
  q?: string
  soon: number
  expired: number
  locations: { id: number; name: string; type: string }[]
}) {
  const chips: Chip[] = [
    { key: 'all', label: '전체' },
    ...(soon > 0 ? [{ key: 'soon', label: `임박 ${soon}`, tone: 'warn' as const }] : []),
    ...(expired > 0 ? [{ key: 'expired', label: `만료 ${expired}`, tone: 'warn' as const }] : []),
    ...locations.map((l) => ({ key: l.name, label: `📍${l.name}` })),
  ]

  const href = (key: string) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (key !== 'all') params.set('filter', key)
    const s = params.toString()
    return s ? `/?${s}` : '/'
  }

  return (
    <nav className="flex gap-1.5 overflow-x-auto border-b border-line px-4 py-2.5 [scrollbar-width:none]">
      {chips.map((c) => {
        const on = active === c.key
        const base = 'whitespace-nowrap rounded-lg border px-2.5 py-1 text-[11.5px]'
        const cls = on
          ? 'border-acc-line bg-acc-soft font-extrabold text-acc'
          : c.tone === 'warn'
            ? 'border-[#f0dcc0] bg-amber-bg font-bold text-amber'
            : 'border-[#e2ddec] text-[#5b5570]'
        return (
          <Link key={c.key} href={href(c.key)} className={`${base} ${cls}`}>
            {c.label}
          </Link>
        )
      })}
    </nav>
  )
}
