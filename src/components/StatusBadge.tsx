import { EXPIRY_CLASS, EXPIRY_LABEL, type ExpiryStatus } from '@/lib/expiry'

/** 상태는 색만으로 말하지 않는다 — 글자를 함께 쓴다 (접근성) */
export function ExpiryBadge({ status, suffix }: { status: ExpiryStatus; suffix?: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-[2px] text-[10px] font-extrabold ${EXPIRY_CLASS[status]}`}
    >
      {EXPIRY_LABEL[status]}
      {suffix ? ` ${suffix}` : ''}
    </span>
  )
}

export function Badge({
  children,
  tone = 'acc',
}: {
  children: React.ReactNode
  tone?: 'acc' | 'amber' | 'red' | 'ok' | 'gray'
}) {
  const cls = {
    acc: 'bg-acc-soft text-acc',
    amber: 'bg-amber-bg text-amber',
    red: 'bg-red-bg text-red',
    ok: 'bg-ok-bg text-ok',
    gray: 'bg-dim text-sub',
  }[tone]
  return (
    <span className={`inline-block rounded-full px-2 py-[2px] text-[10px] font-extrabold ${cls}`}>
      {children}
    </span>
  )
}
