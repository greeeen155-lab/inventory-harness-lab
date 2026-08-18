import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'

const COOKIE = 'inv_session'
const MAX_AGE = 60 * 60 * 24 * 7 // 7일

function secret() {
  const s = process.env.SESSION_SECRET
  if (!s) throw new Error('SESSION_SECRET이 설정되지 않았습니다 (.env 확인)')
  return new TextEncoder().encode(s)
}

export type SessionUser = { id: number; name: string; email: string; role: string }

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret())

  const jar = await cookies()
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
    secure: process.env.NODE_ENV === 'production',
  })
}

export async function destroySession() {
  const jar = await cookies()
  jar.delete(COOKIE)
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    return {
      id: payload.id as number,
      name: payload.name as string,
      email: payload.email as string,
      role: payload.role as string,
    }
  } catch {
    return null
  }
}

/** 서버 컴포넌트·액션에서 현재 로그인 사용자 */
export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  return token ? verifyToken(token) : null
}

/** 로그인 필수 구간에서는 lib/auth.ts의 requireUser()를 쓴다 (DB까지 검증) */

export const SESSION_COOKIE = COOKIE
