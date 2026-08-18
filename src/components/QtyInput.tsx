'use client'

/** 수량 입력칸 — 오른쪽 안쪽에 단위를 붙여 무엇을 넣는 칸인지 바로 보이게 한다 */
export function QtyInput({
  value,
  onChange,
  unit = '개',
  autoFocus,
  size = 'lg',
  className = '',
  tone = 'filled',
  onEnter,
  'aria-label': ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  unit?: string
  autoFocus?: boolean
  size?: 'sm' | 'lg'
  className?: string
  /** 다건 입력에서 빈 칸은 회색, 넘친 칸은 빨강 (05-design 4.11) */
  tone?: 'idle' | 'filled' | 'error'
  /** PC에서 Enter로 저장 */
  onEnter?: () => void
  'aria-label'?: string
}) {
  const big = size === 'lg'
  const border = {
    idle: 'border-[#ddd8e8] text-[#8b859c]',
    filled: 'border-acc',
    error: 'border-red text-red',
  }[tone]

  return (
    <div className={`relative ${className}`}>
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnter) {
            e.preventDefault()
            onEnter()
          }
        }}
        onFocus={(e) => e.currentTarget.select()}
        inputMode="numeric"
        placeholder="0"
        aria-label={ariaLabel}
        className={`w-full rounded-xl border-2 font-extrabold tnum outline-none ${border} ${
          big ? 'px-3.5 py-3 pr-11 text-[20px]' : 'px-2.5 py-1.5 pr-7 text-right text-[15px]'
        }`}
      />
      <span
        className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-bold text-[#5b5570] ${
          big ? 'text-[15px]' : 'text-[12px] right-2'
        }`}
      >
        {unit}
      </span>
    </div>
  )
}
