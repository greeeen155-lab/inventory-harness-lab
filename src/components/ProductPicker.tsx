'use client'

import { useState } from 'react'

export type PickProduct = { id: number; name: string; sku: string; unit: string }

/** 상품 검색 — 저장 후 여기로 돌아와 다음 상품을 이어서 처리한다 (P1 연속 입력) */
export function ProductPicker({
  products,
  onPick,
  title,
}: {
  products: PickProduct[]
  onPick: (p: PickProduct) => void
  title: string
}) {
  const [q, setQ] = useState('')
  const list = q
    ? products.filter((p) => p.name.includes(q) || p.sku.toLowerCase().includes(q.toLowerCase()))
    : products

  return (
    <div>
      <div className="px-4 pt-3">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={title}
          className="w-full rounded-xl bg-[#f0f2f6] px-3.5 py-3 text-[13px] outline-none focus:bg-acc-soft"
        />
      </div>
      <ul className="mt-1">
        {list.map((p) => (
          <li key={p.id}>
            <button
              onClick={() => onPick(p)}
              className="flex w-full items-center justify-between border-b border-line px-4 py-3 text-left active:bg-dim"
            >
              <span className="text-[13px] font-bold">{p.name}</span>
              <span className="text-[10.5px] text-sub">{p.sku}</span>
            </button>
          </li>
        ))}
        {list.length === 0 && (
          <li className="px-4 py-10 text-center text-[13px] text-sub">검색 결과가 없습니다</li>
        )}
      </ul>
    </div>
  )
}
