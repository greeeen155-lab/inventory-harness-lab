import { describe, expect, it } from 'vitest'
import { isPopupExpired } from '@/lib/popup'

describe('Issue #7 팝업 기한 만료 판정', () => {
  const asOf = '2026-08-26'

  it('종료일 다음 날 팝업을 만료 상태로 판정한다', () => {
    expect(isPopupExpired('2026-08-25', asOf)).toBe(true)
  })

  it('종료일 당일에는 팝업을 만료 상태로 판정하지 않는다', () => {
    expect(isPopupExpired('2026-08-26', asOf)).toBe(false)
  })

  it('미래 종료일 팝업은 만료 상태로 판정하지 않는다', () => {
    expect(isPopupExpired('2026-08-27', asOf)).toBe(false)
  })
})
