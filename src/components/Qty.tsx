/**
 * 수량 표기 — 숫자는 크게, 단위는 작고 흐리게.
 * 숫자만 있으면 그게 수량인지 다른 값인지 순간 헷갈린다.
 */
export function Qty({
  value,
  unit = '개',
  size = 'md',
  className = '',
}: {
  value: number
  unit?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const num = {
    sm: 'text-[13px]',
    md: 'text-[15px]',
    lg: 'text-[17px]',
    xl: 'text-[18px]',
  }[size]
  const suffix = {
    sm: 'text-[11.5px]',
    md: 'text-[12.5px]',
    lg: 'text-[13.5px]',
    xl: 'text-[14px]',
  }[size]

  return (
    <span className={`whitespace-nowrap ${className}`}>
      <b className={`${num} font-extrabold tnum`}>{value.toLocaleString()}</b>
      <span className={`${suffix} ml-[2px] font-bold text-[#5b5570]`}>{unit}</span>
    </span>
  )
}
