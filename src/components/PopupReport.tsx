import { SettlementKpi } from './SettlementSentence'

type Row = { name: string; unit: string; shipped: number; sold: number; sample: number; consumed: number; rate: number }

/**
 * 팝업 정산 리포트 (E3)
 *
 * 지금까지 팝업 판매량을 아무도 정확히 몰랐다. 이 화면 하나가 P2(영업)가 이 앱을 쓸 이유가 된다.
 * '거의 안 나간 상품'을 같이 보여주는 이유는 다음 팝업에 그만 가져가기 위해서다.
 */
export function PopupReport({
  report,
}: {
  report: {
    shipped: number
    sold: number
    sample: number
    returned: number
    rate: number
    top: Row[]
    idle: Row[]
  }
}) {
  return (
    <>
      <SettlementKpi
        shipped={report.shipped}
        sold={report.sold}
        sample={report.sample}
        returned={report.returned}
      />

      <p className="px-4 pb-1 pt-5 text-[10.5px] font-extrabold tracking-wider text-sub">
        많이 나간 상품
      </p>
      {report.top.map((r, i) => (
        <div key={r.name} className="border-b border-line px-4 py-2.5">
          <div className="flex items-baseline justify-between">
            <p className="text-[13px] font-bold">
              {i + 1}. {r.name}
            </p>
            <p className="text-[12.5px] font-extrabold tnum">
              {r.consumed}
              <span className="ml-[2px] text-[10.5px] font-bold text-[#5b5570]">{r.unit}</span>
            </p>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-[#efecf6]">
              <div
                className="acc-grad h-full rounded-full"
                style={{ width: `${Math.min(100, Math.round(r.rate * 100))}%` }}
              />
            </div>
            <span className="text-[10.5px] text-sub tnum">
              반출 {r.shipped} · {Math.round(r.rate * 100)}%
            </span>
          </div>
        </div>
      ))}

      {report.idle.length > 0 && (
        <>
          <p className="px-4 pb-1 pt-5 text-[10.5px] font-extrabold tracking-wider text-sub">
            거의 안 나간 상품 — 다음엔 덜 가져가도 됩니다
          </p>
          {report.idle.map((r) => (
            <div key={r.name} className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <p className="text-[13px] font-bold text-[#5b5570]">{r.name}</p>
              <p className="text-[11px] text-sub tnum">
                {r.consumed}
                {r.unit} · 반출 {r.shipped} · {Math.round(r.rate * 100)}%
              </p>
            </div>
          ))}
        </>
      )}
    </>
  )
}
