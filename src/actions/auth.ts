'use server'

import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { createSession, destroySession } from '@/lib/session'

export type LoginState = { error?: string }

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) return { error: '이메일과 비밀번호를 입력하세요' }

  const user = await db.user.findUnique({ where: { email } })
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: '이메일 또는 비밀번호가 올바르지 않습니다' }
  }

  await createSession({ id: user.id, name: user.name, email: user.email, role: user.role })
  redirect('/')
}

export async function logout() {
  await destroySession()
  redirect('/login')
}
