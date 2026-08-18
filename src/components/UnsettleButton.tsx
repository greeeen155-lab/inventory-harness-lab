'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { unsettlePopup } from '@/actions/popup'

/** 정산 되돌리기 (P12) — 삭제가 아니라 상쇄 기록으로 되돌린다 */
export function UnsettleButton({ popupId }: { popupId: number }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const run = async () => {
    setPending(true)
    setError(null)
    const res = await unsettlePopup(popupId)
    setPending(false)
    if (!res.ok) return setError(res.error)
    router.refresh()
  }

  return (
    <div className="mx-4 mt-5">
      <button
        onClick={run}
        disabled={pending}
        className="w-full rounded-xl border border-[#e2ddec] py-3 text-[12.5px] font-bold text-[#5b5570] disabled:opacity-40"
      >
        {pending ? '되돌리는 중…' : '정산 되돌리기'}
      </button>
      <p className="mt-1.5 text-center text-[10.5px] text-sub">
        실물을 다시 세었다면 되돌린 뒤 다시 정산하세요. 기록은 지워지지 않고 상쇄 기록이 남습니다
      </p>
      {error && (
        <p className="mt-2 rounded-xl bg-red-bg px-3.5 py-2.5 text-[12px] font-bold text-red">
          {error}
        </p>
      )}
    </div>
  )
}
