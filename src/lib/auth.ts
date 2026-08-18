import { db } from './db'
import { getSession, destroySession, type SessionUser } from './session'

/**
 * 로그인 사용자 확인 (DB까지 검증).
 *
 * 쿠키의 사용자가 DB에 없을 수 있다 — 시드를 다시 돌렸거나 계정이 지워진 경우다.
 * 그대로 진행하면 Movement 저장에서 외래키 오류가 나므로, 여기서 걸러 세션을 지운다.
 *
 * 주의: 이 파일은 Prisma를 쓰므로 proxy(미들웨어)에서 import 하면 안 된다.
 *       미들웨어는 JWT 검증만 하는 lib/session.ts를 쓴다.
 */
export class SessionExpiredError extends Error {
  constructor() {
    super('로그인 정보가 만료되었습니다. 다시 로그인해주세요')
    this.name = 'SessionExpiredError'
  }
}

export async function requireUser(): Promise<SessionUser> {
  const session = await getSession()
  if (!session) throw new SessionExpiredError()

  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true } })
  if (!user) {
    await destroySession() // 없는 사용자를 가리키는 쿠키는 버린다
    throw new SessionExpiredError()
  }
  return session
}
