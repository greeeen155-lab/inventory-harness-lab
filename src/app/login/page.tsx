'use client'

import { useActionState } from 'react'
import { login, type LoginState } from '@/actions/auth'

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {})

  return (
    <main className="flex min-h-dvh flex-col justify-center px-6">
      <div className="mb-8">
        <div className="acc-grad mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl text-[22px]">
          📦
        </div>
        <h1 className="text-[24px] font-extrabold tracking-tight">재고관리</h1>
        <p className="mt-1.5 text-[13px] text-sub">
          풀필먼트 3사 · 자사창고 · 팝업 재고를 유통기한 순으로 관리합니다
        </p>
      </div>

      <form action={formAction} className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-[11.5px] font-bold text-sub">이메일</span>
          <input
            name="email"
            type="email"
            defaultValue="warehouse@demo.kr"
            required
            className="w-full rounded-xl border border-[#e2ddec] px-3.5 py-3 text-[14px] outline-none focus:border-acc"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[11.5px] font-bold text-sub">비밀번호</span>
          <input
            name="password"
            type="password"
            defaultValue="demo1234"
            required
            className="w-full rounded-xl border border-[#e2ddec] px-3.5 py-3 text-[14px] outline-none focus:border-acc"
          />
        </label>

        {state.error && (
          <p className="rounded-xl bg-red-bg px-3.5 py-2.5 text-[12.5px] font-semibold text-red">
            {state.error}
          </p>
        )}

        <button
          disabled={pending}
          className="acc-grad w-full rounded-xl py-3.5 text-[14.5px] font-extrabold text-white disabled:opacity-60"
        >
          {pending ? '확인 중…' : '로그인'}
        </button>
      </form>

      <div className="mt-8 rounded-xl bg-dim px-4 py-3.5 text-[11.5px] leading-relaxed text-[#5b5570]">
        <b className="mb-1 block text-[11px] tracking-wide text-sub">시연용 계정</b>
        warehouse@demo.kr — 이현 (물류창고)
        <br />
        sales@demo.kr — 민수 (영업)
        <br />
        비밀번호는 둘 다 <b>demo1234</b>
      </div>
    </main>
  )
}
