'use client'

/** 거점·사유 선택칩 (05-design 4.8) — 기본값이 맞으면 손대지 않는다 */
export function PickerRow({
  items,
}: {
  items: {
    label: string
    value: string
    options?: { value: string; label: string }[]
    onChange?: (v: string) => void
    readOnly?: boolean
  }[]
}) {
  return (
    <div className="flex gap-2 px-4 pt-3">
      {items.map((it) => (
        <div
          key={it.label}
          className="flex-1 rounded-xl border border-[#e2ddec] bg-[#f5f3f9] px-3 py-2"
        >
          <span className="block text-[10.5px] text-sub">{it.label}</span>
          {it.options && it.onChange ? (
            <select
              value={it.value}
              onChange={(e) => it.onChange!(e.target.value)}
              className="w-full bg-transparent text-[12.5px] font-bold outline-none"
            >
              {it.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <b className="block text-[12.5px]">{it.value}</b>
          )}
        </div>
      ))}
    </div>
  )
}
