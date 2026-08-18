import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, verifyToken } from '@/lib/session'

/** 로그인하지 않으면 어떤 화면도 볼 수 없다 (재고는 사내 데이터다) */
export async function proxy(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  const user = token ? await verifyToken(token) : null

  const isLoginPage = req.nextUrl.pathname === '/login'

  if (!user && !isLoginPage) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
  if (user && isLoginPage) {
    const url = req.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)'],
}
