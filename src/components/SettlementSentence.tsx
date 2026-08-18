/**
 * 역산 결과 확인 (P8, 05-design 4.12)
 *
 * P2(영업)는 이 앱을 2주에 한 번 연다. 숫자만 보여주면 무엇을 확정하는지 모른 채 누른다.
 * 그래서 확정 직전에 사람 말로 한 번 더 보여준다.
 */
export function SettlementSentence({
  shipped,
  returned,
  sample,
  sold,
  unit = '개',
}: {
  shipped: number
  returned: number
  sample: number
  sold: number
  unit?: string
}) {
  const consumed = shipped - returned

  return (
    <div className="mx-4 mt-4 rounded-xl border border-acc-line bg-acc-soft px-4 py-3.5">
      <p className="text-[13px] leading-relaxed text-[#3d2f63]">
        <b className="tnum text-acc">
          {shipped.toLocaleString()}
          {unit}
        </b>
        를 가져갔고{' '}
        <b className="tnum text-acc">
          {returned.toLocaleString()}
          {unit}
        </b>
        가 돌아왔습니다.
        <br />
        차감{' '}
        <b className="tnum text-acc">
          {consumed.toLocaleString()}
          {unit}
        </b>{' '}
        중 시식·증정{' '}
        <b className="tnum text-acc">
          {sample.toLocaleString()}
          {unit}
        </b>
        를 빼고{' '}
        <b className="tnum text-acc">
          {sold.toLocaleString()}
          {unit}를 판매로 기록
        </b>
        합니다.
      </p>
    </div>
  )
}

/** 반출 / 판매 / 시식·증정 / 반입 네 칸 */
export function SettlementKpi({
  shipped,
  sold,
  sample,
  returned,
}: {
  shipped: number
  sold: number
  sample: number
  returned: number
}) {
  const rate = shipped > 0 ? Math.round(((sold + sample) / shipped) * 100) : 0
  const cells = [
    { label: '반출', value: shipped },
    { label: '판매', value: sold },
    { label: '시식·증정', value: sample },
    { label: '반입', value: returned },
  ]

  return (
    <div className="mx-4 mt-3">
      <div className="grid grid-cols-4 overflow-hidden rounded-xl border border-line">
        {cells.map((c) => (
          <div key={c.label} className="border-r border-line px-2 py-2.5 text-center last:border-r-0">
            <p className="text-[16px] font-extrabold tnum">{c.value.toLocaleString()}</p>
            <p className="mt-[2px] text-[10px] text-sub">{c.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-center text-[11.5px] font-bold text-acc tnum">
        소진율 {rate}% <span className="font-normal text-sub">(판매 + 시식·증정 ÷ 누적 반출)</span>
      </p>
    </div>
  )
}
